-- Migration: Update Leave Calculation with Flexible Hours and Seniority Suspensions
-- Date: 2026-02-16

-- 1. Updated Function to calculate special leave entitlement (Cores logic)
CREATE OR REPLACE FUNCTION calculate_special_leave_entitlement(join_date date, target_date date DEFAULT CURRENT_DATE, employee_id uuid DEFAULT NULL)
RETURNS decimal(10, 2) AS $$
DECLARE
    emp_std_hours decimal(10, 2) := 8.0;
    suspension_days int := 0;
    adjusted_join_date date;
    years_of_service interval;
    full_years int;
    total_days int := 0;
    i int;
BEGIN
    IF join_date IS NULL OR join_date > target_date THEN
        RETURN 0;
    END IF;

    -- Get standard daily hours and seniority suspensions if employee_id is provided
    IF calculate_special_leave_entitlement.employee_id IS NOT NULL THEN
        SELECT standard_daily_hours INTO emp_std_hours FROM employees WHERE id = calculate_special_leave_entitlement.employee_id;
        SELECT COALESCE(SUM(end_date - start_date + 1), 0) INTO suspension_days 
        FROM seniority_suspensions 
        WHERE employee_id = calculate_special_leave_entitlement.employee_id AND start_date <= target_date;
    END IF;

    -- Calculate adjusted join date (pushing it forward by suspension days)
    adjusted_join_date := join_date + (suspension_days * interval '1 day');
    
    IF adjusted_join_date > target_date THEN
        RETURN 0;
    END IF;

    years_of_service := age(target_date, adjusted_join_date);
    full_years := EXTRACT(YEAR FROM years_of_service);

    -- 滿 6 個月 milestone: +3 天
    IF years_of_service >= interval '6 months' THEN
        total_days := total_days + 3;
    END IF;

    -- 滿週年 milestones: 累加各階段天數
    IF full_years >= 1 THEN
        FOR i IN 1..full_years LOOP
            IF i = 1 THEN total_days := total_days + 7;
            ELSIF i = 2 THEN total_days := total_days + 10;
            ELSIF i >= 3 AND i < 5 THEN total_days := total_days + 14;
            ELSIF i >= 5 AND i < 10 THEN total_days := total_days + 15;
            ELSIF i >= 10 THEN 
                total_days := total_days + LEAST(16 + (i - 10), 30);  -- 勞基法§38：滿10年=16日，每增1年加1日，上限30日
            END IF;
        END LOOP;
    END IF;

    -- Use standard daily hours
    RETURN total_days * COALESCE(emp_std_hours, 8.0);
END;
$$ LANGUAGE plpgsql;

-- 2. Updated Comprehensive Leave Balance Function
CREATE OR REPLACE FUNCTION get_employee_leave_balances(target_employee_id uuid, target_date date DEFAULT CURRENT_DATE)
RETURNS json AS $$
DECLARE
    emp_record record;
    join_dt date;
    emp_std_hours decimal(10, 2);
    suspension_days int := 0;
    adjusted_join_dt date;
    
    -- Annual Leave totals
    total_annual_entitlement decimal(10, 2) := 0;
    total_annual_used decimal(10, 2) := 0;
    total_annual_cashout decimal(10, 2) := 0;
    
    -- Period calculation variables
    periods_json jsonb := '[]'::jsonb;
    p_label text;
    p_start date;
    p_end date;
    p_days int;
    p_entitlement_hours decimal(10, 2);
    p_used_hours decimal(10, 2);
    p_cashout_hours decimal(10, 2);
    
    full_years int;
    i int;
    
    -- Compensatory Leave
    comp_earned decimal(10, 2);
    comp_used decimal(10, 2);
    comp_cashout decimal(10, 2);
    
    result json;
BEGIN
    SELECT * INTO emp_record FROM employees WHERE id = target_employee_id;
    IF emp_record IS NULL THEN RETURN json_build_object('error', 'Employee not found'); END IF;
    
    emp_std_hours := COALESCE(emp_record.standard_daily_hours, 8.0);
    
    -- Check for NULL join_date
    IF emp_record.join_date IS NULL THEN 
        RETURN json_build_object(
            'error', 'Employee join date is missing',
            'annual_leave', json_build_object(
                'total_entitlement', 0,
                'total_used', 0,
                'total_cashout', 0,
                'total_remaining', 0,
                'periods', '[]'::jsonb
            ),
            'compensatory_leave', json_build_object(
                'total_entitlement', 0,
                'total_used', 0,
                'total_cashout', 0,
                'total_remaining', 0,
                'periods', '[]'::jsonb
            )
        );
    END IF;
    
    join_dt := emp_record.join_date::date;
    
    -- Calculate total suspension days to date
    SELECT COALESCE(SUM(end_date - start_date + 1), 0) INTO suspension_days 
    FROM seniority_suspensions 
    WHERE employee_id = target_employee_id AND start_date <= target_date;
    
    adjusted_join_dt := join_dt + (suspension_days * interval '1 day');
    full_years := EXTRACT(YEAR FROM age(target_date, adjusted_join_dt));

    -- --- 1. SPECIAL LEAVE (ANNUAL) BREAKDOWN ---
    
    -- Milestone: 各週年 (由新到舊)
    IF full_years >= 1 THEN
        FOR i IN REVERSE full_years..1 LOOP
            p_label := '滿 ' || i || ' 年';
            p_start := adjusted_join_dt + (i * interval '1 year');
            p_end := adjusted_join_dt + ((i + 1) * interval '1 year');
            
            IF i = 1 THEN p_days := 7;
            ELSIF i = 2 THEN p_days := 10;
            ELSIF i >= 3 AND i < 5 THEN p_days := 14;
            ELSIF i >= 5 AND i < 10 THEN p_days := 15;
            ELSE p_days := LEAST(16 + (i - 10), 30);  -- 勞基法§38：滿10年=16日，每增1年加1日，上限30日
            END IF;
            
            p_entitlement_hours := p_days * emp_std_hours;
            
            SELECT COALESCE(SUM(hours), 0) INTO p_used_hours FROM leave_requests
            WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
              AND type = 'LEAVE' AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ANNUAL')
              AND start_date >= p_start AND start_date < p_end;
 
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_cashout_hours FROM leave_balance_adjustments
            WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT'
              AND created_at >= p_start AND created_at < p_end;
 
            periods_json := periods_json || jsonb_build_object(
                'label', p_label, 'start_date', p_start, 'end_date', p_end,
                'entitlement', p_entitlement_hours, 'used', p_used_hours, 'cashout', p_cashout_hours,
                'remaining', (p_entitlement_hours - p_used_hours - p_cashout_hours)
            );
            
            total_annual_entitlement := total_annual_entitlement + p_entitlement_hours;
        END LOOP;
    END IF;

    -- Milestone: 滿 6 個月 (3 天)
    IF age(target_date, adjusted_join_dt) >= interval '6 months' THEN
        p_label := '滿 0.5 年';
        p_start := adjusted_join_dt + interval '6 months';
        p_end := adjusted_join_dt + interval '1 year';
        p_days := 3;
        p_entitlement_hours := p_days * emp_std_hours;
        
        -- 在此期間內的已用時數
        SELECT COALESCE(SUM(hours), 0) INTO p_used_hours FROM leave_requests
        WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
          AND type = 'LEAVE' AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ANNUAL')
          AND start_date >= p_start AND start_date < p_end;
          
        SELECT COALESCE(SUM(amount_hours), 0) INTO p_cashout_hours FROM leave_balance_adjustments
        WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT'
          AND created_at >= p_start AND created_at < p_end;
 
        periods_json := periods_json || jsonb_build_object(
            'label', p_label, 'start_date', p_start, 'end_date', p_end,
            'entitlement', p_entitlement_hours, 'used', p_used_hours, 'cashout', p_cashout_hours,
            'remaining', (p_entitlement_hours - p_used_hours - p_cashout_hours)
        );
        
        total_annual_entitlement := total_annual_entitlement + p_entitlement_hours;
    END IF;
 
    -- 手動調整 (GRANT)
    DECLARE
        annual_granted decimal(10, 2);
    BEGIN
        SELECT COALESCE(SUM(amount_hours), 0) INTO annual_granted FROM leave_balance_adjustments
        WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type IN ('GRANT', 'CORRECTION');
        total_annual_entitlement := total_annual_entitlement + annual_granted;
    END;
 
    -- 總體已用與折現 (不分時段)
    SELECT COALESCE(SUM(hours), 0) INTO total_annual_used FROM leave_requests
    WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
      AND type = 'LEAVE' AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ANNUAL');
 
    SELECT COALESCE(SUM(amount_hours), 0) INTO total_annual_cashout FROM leave_balance_adjustments
    WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT';
 
    -- --- 2. COMPENSATORY LEAVE BREAKDOWN (Remains largely same, use adjusted dates if applicable) ---
    DECLARE
        comp_periods_json jsonb := '[]'::jsonb;
        p_comp_earned decimal(10, 2);
        p_comp_used decimal(10, 2);
        p_comp_cashout decimal(10, 2);
        ot_hours decimal(10, 2);
        ot_type_id uuid;
        comp_leave_type_id uuid;
        toil_type_id uuid;
    BEGIN
        SELECT id INTO ot_type_id FROM leave_types WHERE code = 'OT';
        SELECT id INTO comp_leave_type_id FROM leave_types WHERE code = 'COMPENSATORY';
        SELECT id INTO toil_type_id FROM leave_types WHERE code = 'TOIL';
 
        -- Milestone: 各週年 (由新到舊)
        IF full_years >= 1 THEN
            FOR i IN REVERSE full_years..1 LOOP
                p_start := adjusted_join_dt + ((i - 1) * interval '1 year');
                p_end := adjusted_join_dt + (i * interval '1 year');
                
                -- Earned (OT + Adjustments)
                SELECT COALESCE(SUM(hours), 0) INTO ot_hours FROM leave_requests
                WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
                  AND leave_type_id = ot_type_id AND start_date >= p_start AND start_date < p_end;
                  
                SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_earned FROM leave_balance_adjustments
                WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type IN ('GRANT', 'CORRECTION')
                  AND created_at >= p_start AND created_at < p_end;
                
                p_comp_earned := p_comp_earned + ot_hours;
 
                -- Used & Cashout
                SELECT COALESCE(SUM(hours), 0) INTO p_comp_used FROM leave_requests
                WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
                  AND leave_type_id = toil_type_id AND start_date >= p_start AND start_date < p_end;
 
                SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_cashout FROM leave_balance_adjustments
                WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type = 'CASHOUT'
                  AND created_at >= p_start AND created_at < p_end;
 
                comp_periods_json := comp_periods_json || jsonb_build_object(
                    'label', '滿 ' || i || ' 年', 'start_date', p_start, 'end_date', p_end,
                    'entitlement', p_comp_earned, 'used', p_comp_used, 'cashout', p_comp_cashout,
                    'remaining', (p_comp_earned - p_comp_used - p_comp_cashout)
                );
            END LOOP;
        END IF;
 
        -- Milestone: 一年以下 - 從加保日到滿一年
        IF age(target_date, adjusted_join_dt) >= interval '1 year' OR (age(target_date, adjusted_join_dt) >= interval '0 days' AND full_years = 0) THEN
            p_start := adjusted_join_dt;
            p_end := adjusted_join_dt + interval '1 year';
            
            -- Earned (OT + Adjustments)
            SELECT COALESCE(SUM(hours), 0) INTO ot_hours FROM leave_requests
            WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
              AND leave_type_id = ot_type_id AND start_date >= p_start AND start_date < p_end;
              
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_earned FROM leave_balance_adjustments
            WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type IN ('GRANT', 'CORRECTION')
              AND created_at >= p_start AND created_at < p_end;
            
            p_comp_earned := p_comp_earned + ot_hours;
 
            -- Used & Cashout
            SELECT COALESCE(SUM(hours), 0) INTO p_comp_used FROM leave_requests
            WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
              AND leave_type_id = toil_type_id AND start_date >= p_start AND start_date < p_end;
 
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_cashout FROM leave_balance_adjustments
            WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type = 'CASHOUT'
              AND created_at >= p_start AND created_at < p_end;
 
            comp_periods_json := comp_periods_json || jsonb_build_object(
                'label', '一年以下', 'start_date', p_start, 'end_date', p_end,
                'entitlement', p_comp_earned, 'used', p_comp_used, 'cashout', p_comp_cashout,
                'remaining', (p_comp_earned - p_comp_used - p_comp_cashout)
            );
        END IF;
 
        -- 總計 (包含不分時段的手動調整)
        SELECT COALESCE(SUM(hours), 0) INTO ot_hours FROM leave_requests
        WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
          AND leave_type_id = ot_type_id;
 
        SELECT COALESCE(SUM(amount_hours), 0) INTO comp_earned FROM leave_balance_adjustments
        WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type IN ('GRANT', 'CORRECTION');
        
        comp_earned := comp_earned + ot_hours;
 
        SELECT COALESCE(SUM(hours), 0) INTO comp_used FROM leave_requests
        WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
          AND leave_type_id = toil_type_id;
 
        SELECT COALESCE(SUM(amount_hours), 0) INTO comp_cashout FROM leave_balance_adjustments
        WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type = 'CASHOUT';
        
        -- Build final JSON
        result := json_build_object(
            'annual', json_build_object(
                'entitlement', total_annual_entitlement,
                'used', total_annual_used,
                'cashout', total_annual_cashout,
                'remaining', (total_annual_entitlement - total_annual_used - total_annual_cashout),
                'periods', periods_json
            ),
            'compensatory_leave', json_build_object(
                'total_entitlement', comp_earned,
                'total_used', comp_used,
                'total_cashout', comp_cashout,
                'total_remaining', (comp_earned - comp_used - comp_cashout),
                'periods', comp_periods_json
            )
        );
    END;
 
    RETURN result;
END;
$$ LANGUAGE plpgsql;

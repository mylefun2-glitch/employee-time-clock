-- migration_refine_compensatory_logic.sql
-- 重新定義補休統計邏輯：總額(Entitlement)僅包含加班(OT)，已用(Used)包含補休申請與加班折算(CO)

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
    result json;
    calc_total_earned decimal(10, 2) := 0;
    calc_total_used decimal(10, 2) := 0;
    calc_total_cashout decimal(10, 2) := 0;
    
    -- Overtime Total
    total_ot_hours decimal(10, 2) := 0;
BEGIN
    SELECT * INTO emp_record FROM employees WHERE id = target_employee_id;
    IF emp_record IS NULL THEN RETURN json_build_object('error', 'Employee not found'); END IF;
    
    emp_std_hours := COALESCE(emp_record.standard_daily_hours, 8.0);

    -- Check for NULL join_date
    IF emp_record.join_date IS NULL THEN 
        RETURN json_build_object(
            'error', 'Employee join date is missing',
            'annual', json_build_object(
                'entitlement', 0, 'used', 0, 'cashout', 0, 'remaining', 0, 'periods', '[]'::jsonb
            ),
            'compensatory', json_build_object(
                'entitlement', 0, 'used', 0, 'cashout', 0, 'remaining', 0, 'overtime_total', 0, 'periods', '[]'::jsonb
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
    -- 獲取 ALC 類型 ID 以計入特休折現
    DECLARE
        alc_type_id uuid;
        annual_type_id uuid;
    BEGIN
        SELECT id INTO alc_type_id FROM leave_types WHERE code = 'ALC';
        SELECT id INTO annual_type_id FROM leave_types WHERE code = 'ANNUAL';

        IF full_years >= 1 THEN
            FOR i IN REVERSE full_years..1 LOOP
                p_label := '滿 ' || i || ' 年';
                p_start := adjusted_join_dt + (i * interval '1 year');
                p_end := adjusted_join_dt + ((i + 1) * interval '1 year');
                
                IF i = 1 THEN p_days := 7;
                ELSIF i = 2 THEN p_days := 10;
                ELSIF i >= 3 AND i < 5 THEN p_days := 14;
                ELSIF i >= 5 AND i < 10 THEN p_days := 15;
                ELSE p_days := LEAST(15 + (i - 10), 30);
                END IF;
                
                p_entitlement_hours := p_days * emp_std_hours;
                
                -- 請假 (ANNUAL)
                SELECT COALESCE(SUM(hours), 0) INTO p_used_hours FROM leave_requests
                WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
                  AND leave_type_id = annual_type_id
                  AND start_date >= p_start AND start_date < p_end;
    
                -- 折現 (調整紀錄 + ALC 申請)
                SELECT COALESCE(SUM(amount_hours), 0) INTO p_cashout_hours FROM leave_balance_adjustments
                WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT'
                  AND created_at >= p_start AND created_at < p_end;
                
                DECLARE
                    alc_hours decimal(10, 2);
                BEGIN
                    SELECT COALESCE(SUM(hours), 0) INTO alc_hours FROM leave_requests
                    WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
                      AND leave_type_id = alc_type_id
                      AND start_date >= p_start AND start_date < p_end;
                    p_cashout_hours := p_cashout_hours + alc_hours;
                END;
    
                periods_json := periods_json || jsonb_build_object(
                    'label', p_label, 'start_date', p_start, 'end_date', p_end,
                    'entitlement', p_entitlement_hours, 'used', p_used_hours, 'cashout', p_cashout_hours,
                    'remaining', (p_entitlement_hours - p_used_hours - p_cashout_hours)
                );
                
                total_annual_entitlement := total_annual_entitlement + p_entitlement_hours;
            END LOOP;
        END IF;

        -- Milestone: 滿 6 個月
        IF age(target_date, adjusted_join_dt) >= interval '6 months' THEN
            p_label := '滿 0.5 年';
            p_start := adjusted_join_dt + interval '6 months';
            p_end := adjusted_join_dt + interval '1 year';
            p_days := 3;
            p_entitlement_hours := p_days * emp_std_hours;
            
            SELECT COALESCE(SUM(hours), 0) INTO p_used_hours FROM leave_requests
            WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
              AND leave_type_id = annual_type_id
              AND start_date >= p_start AND start_date < p_end;
              
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_cashout_hours FROM leave_balance_adjustments
            WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT'
              AND created_at >= p_start AND created_at < p_end;
            
            DECLARE
                alc_hours_half decimal(10, 2);
            BEGIN
                SELECT COALESCE(SUM(hours), 0) INTO alc_hours_half FROM leave_requests
                WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
                  AND leave_type_id = alc_type_id
                  AND start_date >= p_start AND start_date < p_end;
                p_cashout_hours := p_cashout_hours + alc_hours_half;
            END;
    
            periods_json := periods_json || jsonb_build_object(
                'label', p_label, 'start_date', p_start, 'end_date', p_end,
                'entitlement', p_entitlement_hours, 'used', p_used_hours, 'cashout', p_cashout_hours,
                'remaining', (p_entitlement_hours - p_used_hours - p_cashout_hours)
            );
            
            total_annual_entitlement := total_annual_entitlement + p_entitlement_hours;
        END IF;
    END;
 
    -- Manual annual adjustments
    DECLARE
        annual_granted decimal(10, 2);
    BEGIN
        SELECT COALESCE(SUM(amount_hours), 0) INTO annual_granted FROM leave_balance_adjustments
        WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type IN ('GRANT', 'CORRECTION');
        total_annual_entitlement := total_annual_entitlement + annual_granted;
    END;
 
    SELECT COALESCE(SUM(hours), 0) INTO total_annual_used FROM leave_requests
    WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
      AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ANNUAL');
 
    -- 總折現彙總 (含 ALC)
    DECLARE
        total_alc_hours decimal(10, 2);
    BEGIN
        SELECT COALESCE(SUM(amount_hours), 0) INTO total_annual_cashout FROM leave_balance_adjustments
        WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT';
        
        SELECT COALESCE(SUM(hours), 0) INTO total_alc_hours FROM leave_requests
        WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
          AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ALC');
          
        total_annual_cashout := total_annual_cashout + total_alc_hours;
    END;

    -- --- 2. COMPENSATORY LEAVE BREAKDOWN ---
    DECLARE
        comp_periods_json jsonb := '[]'::jsonb;
        p_comp_earned decimal(10, 2);
        p_comp_used decimal(10, 2);
        p_comp_cashout_adj decimal(10, 2);
        ot_hours decimal(10, 2);
        co_hours decimal(10, 2);
        ot_type_id uuid;
        co_type_id uuid;
        comp_leave_type_id uuid;
        toil_type_id uuid;
        periods_count int;
    BEGIN
        SELECT id INTO ot_type_id FROM leave_types WHERE code = 'OT';
        SELECT id INTO co_type_id FROM leave_types WHERE code = 'CO';
        SELECT id INTO comp_leave_type_id FROM leave_types WHERE code = 'COMPENSATORY';
        SELECT id INTO toil_type_id FROM leave_types WHERE code = 'TOIL';
 
        -- 顯示從入職到目前的每個年度區間
        periods_count := full_years + 1;
 
        FOR i IN REVERSE periods_count..1 LOOP
            p_start := adjusted_join_dt + ((i - 1) * interval '1 year');
            p_end := adjusted_join_dt + (i * interval '1 year');
            
            IF i = 1 THEN p_label := '一年以下'; ELSE p_label := '滿 ' || (i - 1) || ' 年'; END IF;
            
            -- Earned (僅限 OT + GRANT)
            SELECT COALESCE(SUM(hours), 0) INTO ot_hours FROM leave_requests
            WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
              AND leave_type_id = ot_type_id AND start_date >= p_start AND start_date < p_end;
              
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_earned FROM leave_balance_adjustments
            WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type IN ('GRANT', 'CORRECTION')
              AND created_at >= p_start AND created_at < p_end;
            
            p_comp_earned := p_comp_earned + ot_hours;
 
            -- Used (補休申請 + CO 折算)
            SELECT COALESCE(SUM(hours), 0) INTO p_comp_used FROM leave_requests
            WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
              AND leave_type_id IN (toil_type_id, comp_leave_type_id, co_type_id)
              AND start_date >= p_start AND start_date < p_end;
 
            -- Cashout (手動折現調整)
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_cashout_adj FROM leave_balance_adjustments
            WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type = 'CASHOUT'
              AND created_at >= p_start AND created_at < p_end;
 
            comp_periods_json := comp_periods_json || jsonb_build_object(
                'label', p_label, 'start_date', p_start, 'end_date', p_end,
                'entitlement', p_comp_earned, 'used', p_comp_used, 'cashout', p_comp_cashout_adj,
                'remaining', (p_comp_earned - p_comp_used - p_comp_cashout_adj)
            );
 
            calc_total_earned := calc_total_earned + p_comp_earned;
            calc_total_used := calc_total_used + p_comp_used;
            calc_total_cashout := calc_total_cashout + p_comp_cashout_adj;
        END LOOP;
        
        -- 加班總時數 (僅計入 OT)
        SELECT COALESCE(SUM(hours), 0) INTO total_ot_hours FROM leave_requests
        WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
          AND leave_type_id = ot_type_id;
  
        result := json_build_object(
            'annual', json_build_object(
                'entitlement', total_annual_entitlement,
                'used', total_annual_used,
                'cashout', total_annual_cashout,
                'remaining', (total_annual_entitlement - total_annual_used - total_annual_cashout),
                'periods', periods_json
            ),
            'compensatory', json_build_object(
                'entitlement', calc_total_earned,
                'used', calc_total_used,
                'cashout', calc_total_cashout,
                'remaining', (calc_total_earned - calc_total_used - calc_total_cashout),
                'overtime_total', total_ot_hours,
                'periods', comp_periods_json
            )
        );
    END;
  
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Migration: Leave Balance Schema & Calculation Logic
-- Date: 2026-02-13

-- 1. Create table for manual leave balance adjustments (e.g., adding Compensatory Leave)
CREATE TABLE IF NOT EXISTS leave_balance_adjustments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    employee_id uuid REFERENCES employees(id) NOT NULL,
    leave_type_code text NOT NULL, -- 'ANNUAL' (Special Leave) or 'COMPENSATORY'
    amount_hours decimal(10, 2) NOT NULL,
    reason text,
    created_by uuid
);

-- Ensure adjustment_type exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_balance_adjustments' AND column_name='adjustment_type') THEN
        ALTER TABLE leave_balance_adjustments ADD COLUMN adjustment_type text NOT NULL DEFAULT 'GRANT' CHECK (adjustment_type IN ('GRANT', 'CASHOUT', 'CORRECTION'));
    END IF;
END $$;

-- Enable RLS
ALTER TABLE leave_balance_adjustments ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON leave_balance_adjustments;
CREATE POLICY "Enable read access for all users" ON leave_balance_adjustments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON leave_balance_adjustments;
CREATE POLICY "Enable insert for all users" ON leave_balance_adjustments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON leave_balance_adjustments;
CREATE POLICY "Enable update for all users" ON leave_balance_adjustments FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON leave_balance_adjustments;
CREATE POLICY "Enable delete for all users" ON leave_balance_adjustments FOR DELETE USING (true);

-- 2. Function to calculate Special Leave (Annual Leave) entitlement (Cumulative since hire)
CREATE OR REPLACE FUNCTION calculate_special_leave_entitlement(join_date date, target_date date DEFAULT CURRENT_DATE)
RETURNS decimal(10, 2) AS $$
DECLARE
    years_of_service interval;
    full_years int;
    total_days int := 0;
    i int;
BEGIN
    IF join_date IS NULL OR join_date > target_date THEN
        RETURN 0;
    END IF;

    years_of_service := age(target_date, join_date);
    full_years := EXTRACT(YEAR FROM years_of_service);

    -- 滿 6 個月 milestone: +3 天
    IF years_of_service >= interval '6 months' THEN
        total_days := total_days + 3;
    END IF;

    -- 滿週年 milestones: 累加各階段天數
    -- 1年:7, 2年:10, 3-4年:14, 5-9年:15, 10年+:15+(y-10) max 30
    IF full_years >= 1 THEN
        FOR i IN 1..full_years LOOP
            IF i = 1 THEN total_days := total_days + 7;
            ELSIF i = 2 THEN total_days := total_days + 10;
            ELSIF i >= 3 AND i < 5 THEN total_days := total_days + 14;
            ELSIF i >= 5 AND i < 10 THEN total_days := total_days + 15;
            ELSIF i >= 10 THEN 
                total_days := total_days + LEAST(15 + (i - 10), 30);
            END IF;
        END LOOP;
    END IF;

    -- 轉換為小時 (假設每天 8 小時)
    RETURN total_days * 8.0;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to get comprehensive leave balances for an employee (with yearly breakdown)
CREATE OR REPLACE FUNCTION get_employee_leave_balances(target_employee_id uuid, target_date date DEFAULT CURRENT_DATE)
RETURNS json AS $$
DECLARE
    emp_record record;
    join_dt date;
    
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
    
    join_dt := emp_record.join_date::date;
    full_years := EXTRACT(YEAR FROM age(target_date, join_dt));

    -- --- 1. SPECIAL LEAVE (ANNUAL) BREAKDOWN ---
    
    -- Milestone: 滿 6 個月 (3 天)
    IF age(target_date, join_dt) >= interval '6 months' THEN
        p_label := '滿 0.5 年';
        p_start := join_dt + interval '6 months';
        p_end := join_dt + interval '1 year';
        p_days := 3;
        p_entitlement_hours := p_days * 8.0;
        
        -- 在此期間內的已用時數 (注意：特休的使用期限通常是到下一個里程碑)
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

    -- Milestone: 各週年
    IF full_years >= 1 THEN
        FOR i IN 1..full_years LOOP
            p_label := '滿 ' || i || ' 年';
            p_start := join_dt + (i * interval '1 year');
            p_end := join_dt + ((i + 1) * interval '1 year');
            
            IF i = 1 THEN p_days := 7;
            ELSIF i = 2 THEN p_days := 10;
            ELSIF i >= 3 AND i < 5 THEN p_days := 14;
            ELSIF i >= 5 AND i < 10 THEN p_days := 15;
            ELSE p_days := LEAST(15 + (i - 10), 30);
            END IF;
            
            p_entitlement_hours := p_days * 8.0;
            
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

    -- --- 2. COMPENSATORY LEAVE BREAKDOWN ---
    -- Iterate through the same periods as Special Leave for consistency
    DECLARE
        comp_periods_json jsonb := '[]'::jsonb;
        p_comp_earned decimal(10, 2);
        p_comp_used decimal(10, 2);
        p_comp_cashout decimal(10, 2);
        ot_hours decimal(10, 2);
        ot_type_id uuid;
        comp_leave_type_id uuid;
    BEGIN
        SELECT id INTO ot_type_id FROM leave_types WHERE code = 'OT';
        SELECT id INTO comp_leave_type_id FROM leave_types WHERE code = 'COMPENSATORY';

        -- Milestone: 滿 6 個月
        IF age(target_date, join_dt) >= interval '6 months' THEN
            p_start := join_dt + interval '6 months';
            p_end := join_dt + interval '1 year';
            
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
              AND leave_type_id = comp_leave_type_id AND start_date >= p_start AND start_date < p_end;

            SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_cashout FROM leave_balance_adjustments
            WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type = 'CASHOUT'
              AND created_at >= p_start AND created_at < p_end;

            comp_periods_json := comp_periods_json || jsonb_build_object(
                'label', '滿 0.5 年', 'start_date', p_start, 'end_date', p_end,
                'entitlement', p_comp_earned, 'used', p_comp_used, 'cashout', p_comp_cashout,
                'remaining', (p_comp_earned - p_comp_used - p_comp_cashout)
            );
        END IF;

        -- Milestone: 各週年
        IF full_years >= 1 THEN
            FOR i IN 1..full_years LOOP
                p_start := join_dt + (i * interval '1 year');
                p_end := join_dt + ((i + 1) * interval '1 year');
                
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
                  AND leave_type_id = comp_leave_type_id AND start_date >= p_start AND start_date < p_end;

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

        -- 總計 (包含不分時段的手動調整)
        SELECT COALESCE(SUM(hours), 0) INTO ot_hours FROM leave_requests
        WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
          AND leave_type_id = ot_type_id;

        SELECT COALESCE(SUM(amount_hours), 0) INTO comp_earned FROM leave_balance_adjustments
        WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type IN ('GRANT', 'CORRECTION');
        
        comp_earned := comp_earned + ot_hours;

        SELECT COALESCE(SUM(hours), 0) INTO comp_used FROM leave_requests
        WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
          AND leave_type_id = comp_leave_type_id;

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
            'compensatory', json_build_object(
                'entitlement', comp_earned,
                'used', comp_used,
                'cashout', comp_cashout,
                'remaining', (comp_earned - comp_used - comp_cashout),
                'periods', comp_periods_json
            )
        );
    END;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- [HELP] 回補舊資料時數 (若 hours 欄位存在但為空)
-- UPDATE leave_requests 
-- SET hours = ROUND(EXTRACT(EPOCH FROM (end_date - start_date)) / 3600, 1)
-- WHERE hours IS NULL AND type = 'LEAVE';

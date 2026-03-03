-- 比例特休計算與資料完整性修正 (正式強化版 - 終極修復)
-- 執行日期：2026-02-16
-- 解決問題：表格不存在導致的載入中、歷史工時遺失、比例計算錯誤

-- 1. 確保基礎表格存在
CREATE TABLE IF NOT EXISTS seniority_suspensions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    employee_id uuid REFERENCES employees(id) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS leave_balance_adjustments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    employee_id uuid REFERENCES employees(id) NOT NULL,
    leave_type_code text NOT NULL,
    amount_hours decimal(10, 2) NOT NULL,
    adjustment_type text NOT NULL DEFAULT 'GRANT' CHECK (adjustment_type IN ('GRANT', 'CASHOUT', 'CORRECTION')),
    reason text,
    created_by uuid
);

-- 2. 確保必要欄位存在
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='standard_daily_hours') THEN
        ALTER TABLE employees ADD COLUMN standard_daily_hours decimal(10, 2) DEFAULT 8.0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employee_schedules' AND column_name='standard_daily_hours') THEN
        ALTER TABLE employee_schedules ADD COLUMN standard_daily_hours decimal(10, 2);
    END IF;
END $$;

-- 3. 工時計算工具函數
CREATE OR REPLACE FUNCTION calculate_hours_from_times(
    w_start text, w_end text, 
    b1_start text, b1_end text,
    b2_start text, b2_end text,
    b3_start text, b3_end text
) RETURNS decimal AS $$
DECLARE
    total_sec float;
    b1_sec float := 0;
    b2_sec float := 0;
    b3_sec float := 0;
BEGIN
    IF w_start IS NULL OR w_end IS NULL OR w_start = '' OR w_end = '' THEN RETURN 8.0; END IF;
    
    BEGIN
        total_sec := EXTRACT(EPOCH FROM (w_end::time - w_start::time));
        IF b1_start IS NOT NULL AND b1_end IS NOT NULL AND b1_start != '' AND b1_end != '' THEN
            b1_sec := EXTRACT(EPOCH FROM (b1_end::time - b1_start::time));
        END IF;
        IF b2_start IS NOT NULL AND b2_end IS NOT NULL AND b2_start != '' AND b2_end != '' THEN
            b2_sec := EXTRACT(EPOCH FROM (b2_end::time - b2_start::time));
        END IF;
        IF b3_start IS NOT NULL AND b3_end IS NOT NULL AND b3_start != '' AND b3_end != '' THEN
            b3_sec := EXTRACT(EPOCH FROM (b3_end::time - b3_start::time));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN 8.0; -- 格式錯誤時退回到 8.0
    END;
    
    IF total_sec < 0 THEN total_sec := total_sec + 86400; END IF;
    RETURN (total_sec - b1_sec - b2_sec - b3_sec) / 3600.0;
END;
$$ LANGUAGE plpgsql;

-- 4. 資料回填與修復
UPDATE employee_schedules
SET standard_daily_hours = calculate_hours_from_times(
    work_start_time, work_end_time, 
    break_start_time, break_end_time, 
    break2_start_time, break2_end_time, 
    break3_start_time, break3_end_time
)
WHERE standard_daily_hours IS NULL;

-- 為所有員工建立入職起點班表 (若缺少)
INSERT INTO employee_schedules (
    employee_id, effective_date, 
    work_start_time, work_end_time, 
    break_start_time, break_end_time, 
    rest_days, salary_type, standard_daily_hours
)
SELECT 
    id, join_date, 
    '08:00', '17:00', 
    '12:00', '13:00', 
    ARRAY[0, 6], 'MONTHLY', 8.0
FROM employees
WHERE join_date IS NOT NULL
ON CONFLICT (employee_id, effective_date) DO NOTHING;

-- 同步員工當前工時
UPDATE employees
SET standard_daily_hours = calculate_hours_from_times(
    work_start_time, work_end_time, 
    break_start_time, break_end_time, 
    break2_start_time, break2_end_time, 
    break3_start_time, break3_end_time
)
WHERE standard_daily_hours IS NULL OR standard_daily_hours = 8.0;

-- 5. 加權平均工時計算函數
CREATE OR REPLACE FUNCTION calculate_weighted_avg_hours(target_employee_id uuid, earning_start_date date, earning_target_date date, default_hours decimal DEFAULT 8.0)
RETURNS decimal(10, 2) AS $$
DECLARE
    total_earning_days int;
    weighted_avg_hours decimal(10, 2);
BEGIN
    total_earning_days := earning_target_date - earning_start_date;
    IF total_earning_days <= 0 THEN RETURN default_hours; END IF;

    WITH periods AS (
        SELECT 
            effective_date as start_date,
            LEAD(effective_date, 1, '9999-12-31'::date) OVER (ORDER BY effective_date) as end_date,
            COALESCE(standard_daily_hours, default_hours) as hours
        FROM employee_schedules
        WHERE employee_id = target_employee_id
    ),
    intersect_periods AS (
        SELECT 
            GREATEST(start_date, earning_start_date) as s,
            LEAST(end_date - 1, earning_target_date - 1) as e,
            hours
        FROM periods
        WHERE start_date < earning_target_date AND end_date > earning_start_date
    )
    SELECT SUM(hours * (e - s + 1))::decimal / total_earning_days INTO weighted_avg_hours
    FROM intersect_periods WHERE e >= s;

    IF weighted_avg_hours IS NULL OR weighted_avg_hours <= 0 THEN
        SELECT standard_daily_hours INTO weighted_avg_hours FROM employee_schedules WHERE employee_id = target_employee_id ORDER BY ABS(effective_date - earning_start_date) ASC LIMIT 1;
    END IF;
    RETURN COALESCE(weighted_avg_hours, default_hours);
END;
$$ LANGUAGE plpgsql;

-- 6. 更新特休計算函數
CREATE OR REPLACE FUNCTION calculate_special_leave_entitlement(join_date date, target_date date DEFAULT CURRENT_DATE, employee_id uuid DEFAULT NULL)
RETURNS decimal(10, 2) AS $$
DECLARE
    emp_std_hours decimal(10, 2) := 8.0;
    suspension_days int := 0;
    adjusted_join_date date;
    years_of_service interval;
    full_years int;
    total_days int := 0;
    earning_start_date date;
    weighted_avg_hours decimal(10, 2);
BEGIN
    IF join_date IS NULL OR join_date > target_date THEN RETURN 0; END IF;

    IF calculate_special_leave_entitlement.employee_id IS NOT NULL THEN
        SELECT COALESCE(SUM(end_date - start_date + 1), 0) INTO suspension_days FROM seniority_suspensions WHERE employee_id = calculate_special_leave_entitlement.employee_id AND start_date <= target_date;
        SELECT standard_daily_hours INTO emp_std_hours FROM employees WHERE id = calculate_special_leave_entitlement.employee_id;
    END IF;

    adjusted_join_date := join_date + (suspension_days * interval '1 day');
    IF adjusted_join_date > target_date THEN RETURN 0; END IF;

    years_of_service := age(target_date, adjusted_join_date);
    full_years := extract(year from years_of_service);

    IF full_years >= 1 THEN
        earning_start_date := adjusted_join_date + ((full_years - 1) * interval '1 year');
        -- Milestone date is when the anniversary was reached
        IF (adjusted_join_date + (full_years * interval '1 year')) < '2017-01-01'::date THEN
            -- Old Rules
            IF full_years = 1 THEN total_days := 7;
            ELSIF full_years = 2 THEN total_days := 7;
            ELSIF full_years >= 3 AND full_years < 5 THEN total_days := 10;
            ELSIF full_years >= 5 AND full_years < 10 THEN total_days := 14;
            ELSE total_days := LEAST(15 + (full_years - 10), 30);
            END IF;
        ELSE
            -- New Rules
            IF full_years = 1 THEN total_days := 7;
            ELSIF full_years = 2 THEN total_days := 10;
            ELSIF full_years >= 3 AND full_years < 5 THEN total_days := 14;
            ELSIF full_years >= 5 AND full_years < 10 THEN total_days := 15;
            ELSE total_days := LEAST(16 + (full_years - 10), 30);
            END IF;
        END IF;
    ELSIF full_years = 0 AND years_of_service >= interval '6 months' THEN
        earning_start_date := adjusted_join_date;
        -- 2017-01-01 以前滿半年無特休
        IF (adjusted_join_date + interval '6 months') >= '2017-01-01'::date THEN
            total_days := 3;
        ELSE
            RETURN 0;
        END IF;
    ELSE
        RETURN 0;
    END IF;

    IF calculate_special_leave_entitlement.employee_id IS NOT NULL THEN
        weighted_avg_hours := calculate_weighted_avg_hours(calculate_special_leave_entitlement.employee_id, earning_start_date, target_date, emp_std_hours);
    ELSE
        weighted_avg_hours := emp_std_hours;
    END IF;
    RETURN total_days * weighted_avg_hours;
END;
$$ LANGUAGE plpgsql;

-- 7. 最終查詢餘額函數
CREATE OR REPLACE FUNCTION get_employee_leave_balances(target_employee_id uuid, target_date date DEFAULT CURRENT_DATE)
RETURNS json AS $$
DECLARE
    emp_record record;
    join_dt date;
    emp_std_hours decimal(10, 2);
    suspension_days int := 0;
    adjusted_join_dt date;
    total_annual_entitlement decimal(10, 2) := 0;
    total_annual_used decimal(10, 2) := 0;
    total_annual_cashout decimal(10, 2) := 0;
    periods_json jsonb := '[]'::jsonb;
    p_label text; p_start date; p_end date; p_earning_start date; p_earning_end date; p_days int; p_weighted_avg_hours decimal(10, 2); p_entitlement_hours decimal(10, 2); p_used_hours decimal(10, 2); p_cashout_hours decimal(10, 2);
    full_years int; i int; result json;
    
    -- 補休變數
    comp_earned_total decimal(10, 2) := 0; comp_used_total decimal(10, 2) := 0; comp_cashout_total decimal(10, 2) := 0; comp_periods_json jsonb := '[]'::jsonb;
    ot_type_id uuid; comp_leave_type_id uuid; toil_type_id uuid; ot_hours decimal(10, 2); p_comp_earned decimal(10, 2); p_comp_used decimal(10, 2); p_comp_cashout decimal(10, 2);
    calc_total_earned decimal(10, 2) := 0; calc_total_used decimal(10, 2) := 0; calc_total_cashout decimal(10, 2) := 0;
BEGIN
    SELECT * INTO emp_record FROM employees WHERE id = target_employee_id;
    IF emp_record IS NULL THEN RETURN json_build_object('error', 'Employee not found'); END IF;
    emp_std_hours := COALESCE(emp_record.standard_daily_hours, 8.0);
    IF emp_record.join_date IS NULL THEN RETURN json_build_object('error', 'Join date missing'); END IF;
    
    join_dt := emp_record.join_date::date;
    SELECT COALESCE(SUM(end_date - start_date + 1), 0) INTO suspension_days FROM seniority_suspensions WHERE employee_id = target_employee_id AND start_date <= target_date;
    adjusted_join_dt := join_dt + (suspension_days * interval '1 day');
    full_years := EXTRACT(YEAR FROM age(target_date, adjusted_join_dt));

    -- ANNUAL LEAVE
    IF full_years >= 1 THEN
        FOR i IN REVERSE full_years..1 LOOP
            p_start := adjusted_join_dt + (i * interval '1 year');
            p_end := adjusted_join_dt + ((i + 1) * interval '1 year');
            p_earning_start := adjusted_join_dt + ((i - 1) * interval '1 year');
            p_earning_end := adjusted_join_dt + (i * interval '1 year');
            
            IF p_start < '2017-01-01'::date THEN
                -- 舊制
                IF i = 1 THEN p_days := 7; ELSIF i = 2 THEN p_days := 7; ELSIF i >= 3 AND i < 5 THEN p_days := 10; ELSIF i >= 5 AND i < 10 THEN p_days := 14; ELSE p_days := LEAST(15 + (i - 10), 30); END IF;
            ELSE
                -- 新制
                IF i = 1 THEN p_days := 7; ELSIF i = 2 THEN p_days := 10; ELSIF i >= 3 AND i < 5 THEN p_days := 14; ELSIF i >= 5 AND i < 10 THEN p_days := 15; ELSE p_days := LEAST(16 + (i - 10), 30); END IF;
            END IF;
            
            p_weighted_avg_hours := calculate_weighted_avg_hours(target_employee_id, p_earning_start, p_earning_end, emp_std_hours);
            p_entitlement_hours := p_days * p_weighted_avg_hours;
            SELECT COALESCE(SUM(hours), 0) INTO p_used_hours FROM leave_requests WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL) AND type = 'LEAVE' AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ANNUAL') AND start_date >= p_start AND start_date < p_end;
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_cashout_hours FROM leave_balance_adjustments WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT' AND created_at >= p_start AND created_at < p_end;
            periods_json := periods_json || jsonb_build_object('label', '滿 ' || i || ' 年', 'start_date', p_start, 'end_date', p_end, 'entitlement', p_entitlement_hours, 'used', p_used_hours, 'cashout', p_cashout_hours, 'remaining', (p_entitlement_hours - p_used_hours - p_cashout_hours));
            total_annual_entitlement := total_annual_entitlement + p_entitlement_hours;
        END LOOP;
    END IF;

    IF age(target_date, adjusted_join_dt) >= interval '6 months' THEN
        p_start := adjusted_join_dt + interval '6 months'; p_end := adjusted_join_dt + interval '1 year';
        -- 2017-01-01 以前滿半年無特休
        IF p_start >= '2017-01-01'::date THEN
            p_days := 3;
            p_weighted_avg_hours := calculate_weighted_avg_hours(target_employee_id, adjusted_join_dt, p_start, emp_std_hours);
            p_entitlement_hours := p_days * p_weighted_avg_hours;
            SELECT COALESCE(SUM(hours), 0) INTO p_used_hours FROM leave_requests WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL) AND type = 'LEAVE' AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ANNUAL') AND start_date >= p_start AND start_date < p_end;
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_cashout_hours FROM leave_balance_adjustments WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT' AND created_at >= p_start AND created_at < p_end;
            periods_json := periods_json || jsonb_build_object('label', '滿 0.5 年', 'start_date', p_start, 'end_date', p_end, 'entitlement', p_entitlement_hours, 'used', p_used_hours, 'cashout', p_cashout_hours, 'remaining', (p_entitlement_hours - p_used_hours - p_cashout_hours));
            total_annual_entitlement := total_annual_entitlement + p_entitlement_hours;
        END IF;
    END IF;

    SELECT COALESCE(SUM(amount_hours), 0) INTO p_entitlement_hours FROM leave_balance_adjustments WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type IN ('GRANT', 'CORRECTION');
    total_annual_entitlement := total_annual_entitlement + p_entitlement_hours;
    SELECT COALESCE(SUM(hours), 0) INTO total_annual_used FROM leave_requests WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL) AND type = 'LEAVE' AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ANNUAL');
    SELECT COALESCE(SUM(amount_hours), 0) INTO total_annual_cashout FROM leave_balance_adjustments WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT';

    -- COMPENSATORY (補休)
    SELECT id INTO ot_type_id FROM leave_types WHERE code = 'OT';
    SELECT id INTO comp_leave_type_id FROM leave_types WHERE code = 'COMPENSATORY';
    SELECT id INTO toil_type_id FROM leave_types WHERE code = 'TOIL';

    IF full_years >= 1 THEN
        FOR i IN REVERSE full_years..1 LOOP
            p_start := adjusted_join_dt + ((i - 1) * interval '1 year'); p_end := adjusted_join_dt + (i * interval '1 year');
            SELECT COALESCE(SUM(hours), 0) INTO ot_hours FROM leave_requests WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL) AND leave_type_id = ot_type_id AND start_date >= p_start AND start_date < p_end;
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_earned FROM leave_balance_adjustments WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type IN ('GRANT', 'CORRECTION') AND created_at >= p_start AND created_at < p_end;
            p_comp_earned := p_comp_earned + ot_hours;
            SELECT COALESCE(SUM(hours), 0) INTO p_comp_used FROM leave_requests WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL) AND leave_type_id IN (toil_type_id, comp_leave_type_id) AND start_date >= p_start AND start_date < p_end;
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_cashout FROM leave_balance_adjustments WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type = 'CASHOUT' AND created_at >= p_start AND created_at < p_end;
            comp_periods_json := comp_periods_json || jsonb_build_object('label', '滿 ' || (i - 1) || ' 年', 'start_date', p_start, 'end_date', p_end, 'entitlement', p_comp_earned, 'used', p_comp_used, 'cashout', p_comp_cashout, 'remaining', (p_comp_earned - p_comp_used - p_comp_cashout));
            calc_total_earned := calc_total_earned + p_comp_earned;
            calc_total_used := calc_total_used + p_comp_used;
            calc_total_cashout := calc_total_cashout + p_comp_cashout;
        END LOOP;
    END IF;

    IF age(target_date, adjusted_join_dt) >= interval '1 year' OR (age(target_date, adjusted_join_dt) >= interval '0 days' AND full_years = 0) THEN
        p_start := adjusted_join_dt; p_end := adjusted_join_dt + interval '1 year';
        SELECT COALESCE(SUM(hours), 0) INTO ot_hours FROM leave_requests WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL) AND leave_type_id = ot_type_id AND start_date >= p_start AND start_date < p_end;
        SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_earned FROM leave_balance_adjustments WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type IN ('GRANT', 'CORRECTION') AND created_at >= p_start AND created_at < p_end;
        p_comp_earned := p_comp_earned + ot_hours;
        SELECT COALESCE(SUM(hours), 0) INTO p_comp_used FROM leave_requests WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL) AND leave_type_id IN (toil_type_id, comp_leave_type_id) AND start_date >= p_start AND start_date < p_end;
        SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_cashout FROM leave_balance_adjustments WHERE employee_id = target_employee_id AND leave_type_code = 'COMPENSATORY' AND adjustment_type = 'CASHOUT' AND created_at >= p_start AND created_at < p_end;
        comp_periods_json := comp_periods_json || jsonb_build_object('label', '一年以下', 'start_date', p_start, 'end_date', p_end, 'entitlement', p_comp_earned, 'used', p_comp_used, 'cashout', p_comp_cashout, 'remaining', (p_comp_earned - p_comp_used - p_comp_cashout));
        calc_total_earned := calc_total_earned + p_comp_earned;
        calc_total_used := calc_total_used + p_comp_used;
        calc_total_cashout := calc_total_cashout + p_comp_cashout;
    END IF;

    comp_earned_total := calc_total_earned;
    comp_used_total := calc_total_used;
    comp_cashout_total := calc_total_cashout;

    RETURN json_build_object(
        'annual', json_build_object('entitlement', total_annual_entitlement, 'used', total_annual_used, 'cashout', total_annual_cashout, 'remaining', (total_annual_entitlement - total_annual_used - total_annual_cashout), 'periods', periods_json),
        'compensatory', json_build_object('entitlement', comp_earned_total, 'used', comp_used_total, 'cashout', comp_cashout_total, 'remaining', (comp_earned_total - comp_used_total - comp_cashout_total), 'periods', comp_periods_json)
    );
END;
$$ LANGUAGE plpgsql;

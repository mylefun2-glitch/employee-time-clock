
-- 更新 get_employee_leave_balances 函數
-- 1. 還原 date_formula 顯示 (原日期 + 中斷天數)
-- 2. 保留強化後的時數公式描述
-- 3. 處理 2017 新舊制轉銜補貼 3 天
-- 4. 確保 FIFO 分配與里程碑標籤準確

CREATE OR REPLACE FUNCTION get_employee_leave_balances(target_employee_id uuid, target_date date DEFAULT CURRENT_DATE)
RETURNS json AS $$
DECLARE
    emp_record record;
    join_dt date;
    
    -- Annual Leave totals
    total_annual_entitlement decimal(10, 2) := 0;
    total_annual_used decimal(10, 2) := 0;
    total_annual_cashout decimal(10, 2) := 0;
    annual_granted decimal(10, 2) := 0;
    
    -- Allocation variables
    rem_used decimal(10, 2);
    rem_cashout decimal(10, 2);
    alloc_used decimal(10, 2);
    alloc_cashout decimal(10, 2);
    bucket_rem decimal(10, 2);

    -- Bucket variables
    periods_json jsonb := '[]'::jsonb;
    bucket_list jsonb := '[]'::jsonb;
    p_label text; p_start date; p_end date; p_earning_start date; 
    p_weighted_avg_hours decimal(10, 2); p_days int; p_entitlement_hours decimal(10, 2);
    p_date_formula text; p_susp_days int;
    
    emp_std_hours decimal(10, 2);
    suspension_days int := 0;
    adjusted_join_dt date;
    full_years int;
    i int;
    bucket_record record;
    result json;
BEGIN
    SELECT * INTO emp_record FROM employees WHERE id = target_employee_id;
    IF emp_record IS NULL THEN RETURN json_build_object('error', 'Employee not found'); END IF;
    
    join_dt := emp_record.join_date::date;
    emp_std_hours := COALESCE(emp_record.standard_daily_hours, 8.0);
    
    -- 1. 計算年資中斷總天數（截至目標日期）
    SELECT COALESCE(SUM(end_date - start_date + 1), 0) INTO suspension_days FROM seniority_suspensions 
    WHERE employee_id = target_employee_id AND start_date <= target_date;
    adjusted_join_dt := join_dt + (suspension_days * interval '1 day');
    
    full_years := EXTRACT(YEAR FROM age(target_date, adjusted_join_dt));

    -- --- 1. SPECIAL LEAVE (ANNUAL) ---
    SELECT COALESCE(SUM(hours), 0) INTO total_annual_used FROM leave_requests
    WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
      AND type = 'LEAVE' AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ANNUAL');

    SELECT COALESCE(SUM(amount_hours), 0) INTO total_annual_cashout FROM leave_balance_adjustments
    WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT';

    SELECT COALESCE(SUM(amount_hours), 0) INTO annual_granted FROM leave_balance_adjustments
    WHERE employee_id = target_employee_id AND leave_type_code = 'ANNUAL' AND adjustment_type IN ('GRANT', 'CORRECTION');

    -- 生成里程碑桶 (Buckets)
    
    -- 2017-01-01 新制轉銜補貼
    IF (adjusted_join_dt + interval '6 months') < '2017-01-01'::date AND (adjusted_join_dt + interval '1 year') > '2017-01-01'::date THEN
        p_start := '2017-01-01'::date;
        p_end := (adjusted_join_dt + interval '1 year');
        p_weighted_avg_hours := calculate_weighted_avg_hours(target_employee_id, adjusted_join_dt, p_start, emp_std_hours);
        
        SELECT COALESCE(SUM(end_date - start_date + 1), 0) INTO p_susp_days FROM seniority_suspensions WHERE employee_id = target_employee_id AND start_date < p_start;
        p_date_formula := CASE WHEN p_susp_days > 0 THEN '原 ' || (join_dt + interval '6 months')::date || ' + ' || p_susp_days || '天 (新制轉銜補貼)' ELSE NULL END;

        bucket_list := bucket_list || jsonb_build_object(
            'label', '滿 0.5 年 (新制轉銜)', 'start_date', p_start, 'end_date', p_end, 'entitlement', (3 * p_weighted_avg_hours),
            'formula', '3天 * ' || p_weighted_avg_hours || '小時',
            'detail_formula', '3天 * ' || p_weighted_avg_hours || '小時 (2017新制轉銜補貼)',
            'date_formula', p_date_formula
        );
    END IF;

    -- 滿 0.5 年 (新制)
    IF (adjusted_join_dt + interval '6 months') >= '2017-01-01'::date AND target_date >= (adjusted_join_dt + interval '6 months') THEN
        p_start := (adjusted_join_dt + interval '6 months');
        p_weighted_avg_hours := calculate_weighted_avg_hours(target_employee_id, adjusted_join_dt, p_start, emp_std_hours);
        
        SELECT COALESCE(SUM(end_date - start_date + 1), 0) INTO p_susp_days FROM seniority_suspensions WHERE employee_id = target_employee_id AND start_date < p_start;
        p_date_formula := CASE WHEN p_susp_days > 0 THEN '原 ' || (join_dt + interval '6 months')::date || ' + ' || p_susp_days || '天' ELSE NULL END;

        bucket_list := bucket_list || jsonb_build_object(
            'label', '滿 0.5 年', 'start_date', p_start, 'entitlement', (3 * p_weighted_avg_hours),
            'formula', '3天 * ' || p_weighted_avg_hours || '小時',
            'detail_formula', '3天 * ' || p_weighted_avg_hours || '小時 (依年資 ' || (adjusted_join_dt::date) || '~' || (p_start::date) || ' 加權工時)',
            'date_formula', p_date_formula
        );
    END IF;

    -- 各週年
    FOR i IN 1..25 LOOP
        p_start := (adjusted_join_dt + (i * interval '1 year'));
        IF p_start > target_date THEN EXIT; END IF;
        
        p_earning_start := (adjusted_join_dt + ((i - 1) * interval '1 year'));
        
        IF p_start < '2017-01-01'::date THEN
            IF i = 1 THEN p_days := 7; ELSIF i = 2 THEN p_days := 7; ELSIF i >= 3 AND i < 5 THEN p_days := 10; ELSIF i >= 5 AND i < 10 THEN p_days := 14; ELSE p_days := LEAST(15 + (i - 10), 30); END IF;
        ELSE
            IF i = 1 THEN p_days := 7; ELSIF i = 2 THEN p_days := 10; ELSIF i >= 3 AND i < 5 THEN p_days := 14; ELSIF i >= 5 AND i < 10 THEN p_days := 15; ELSE p_days := LEAST(16 + (i - 10), 30); END IF;
        END IF;

        p_weighted_avg_hours := calculate_weighted_avg_hours(target_employee_id, p_earning_start, p_start, emp_std_hours);
        
        SELECT COALESCE(SUM(end_date - start_date + 1), 0) INTO p_susp_days FROM seniority_suspensions WHERE employee_id = target_employee_id AND start_date < p_start;
        p_date_formula := CASE WHEN p_susp_days > 0 THEN '原 ' || (join_dt + (i * interval '1 year'))::date || ' + ' || p_susp_days || '天' ELSE NULL END;

        bucket_list := bucket_list || jsonb_build_object(
            'label', '滿 ' || i || ' 年', 'start_date', p_start, 'entitlement', (p_days * p_weighted_avg_hours),
            'formula', p_days || '天 * ' || p_weighted_avg_hours || '小時',
            'detail_formula', p_days || '天 * ' || p_weighted_avg_hours || '小時 (依年資 ' || (p_earning_start::date) || '~' || (p_start::date) || ' 加權工時)',
            'date_formula', p_date_formula
        );
    END LOOP;

    -- 計算 end_date
    IF jsonb_array_length(bucket_list) > 0 THEN
        SELECT jsonb_agg(
            CASE WHEN curr_val->>'end_date' IS NULL THEN
                jsonb_set(
                    curr_val, '{end_date}', 
                    COALESCE((SELECT next_val->'start_date' FROM jsonb_array_elements(bucket_list) WITH ORDINALITY AS n(next_val, n_idx) WHERE n_idx = curr_idx + 1), to_jsonb((curr_val->>'start_date')::date + interval '1 year'))
                )
            ELSE curr_val END
        ) INTO bucket_list
        FROM jsonb_array_elements(bucket_list) WITH ORDINALITY AS c(curr_val, curr_idx);
    END IF;

    -- FIFO 分配
    rem_used := total_annual_used;
    rem_cashout := total_annual_cashout;
    total_annual_entitlement := annual_granted;

    FOR bucket_record IN SELECT * FROM jsonb_to_recordset(bucket_list) AS x(label text, start_date date, end_date date, entitlement decimal, formula text, detail_formula text, date_formula text) LOOP
        p_entitlement_hours := bucket_record.entitlement;
        total_annual_entitlement := total_annual_entitlement + p_entitlement_hours;

        alloc_used := LEAST(rem_used, p_entitlement_hours);
        rem_used := rem_used - alloc_used;
        bucket_rem := p_entitlement_hours - alloc_used;

        alloc_cashout := LEAST(rem_cashout, bucket_rem);
        rem_cashout := rem_cashout - alloc_cashout;
        bucket_rem := bucket_rem - alloc_cashout;

        periods_json := periods_json || jsonb_build_object(
            'label', bucket_record.label, 'start_date', bucket_record.start_date, 'end_date', bucket_record.end_date,
            'entitlement', p_entitlement_hours, 'formula', bucket_record.detail_formula, 'date_formula', bucket_record.date_formula,
            'used', alloc_used, 'cashout', alloc_cashout, 'remaining', bucket_rem
        );
    END LOOP;

    -- 倒序排列明細
    SELECT jsonb_agg(value) INTO periods_json FROM (
        SELECT value FROM jsonb_array_elements(periods_json) ORDER BY (value->>'start_date')::date DESC
    ) x;

    -- --- 2. COMPENSATORY LEAVE ---
    DECLARE
        comp_periods_json jsonb := '[]'::jsonb;
        comp_bucket_list jsonb := '[]'::jsonb;
        calc_total_earned decimal(10, 2) := 0;
        total_comp_used decimal(10, 2) := 0;
        total_comp_cashout decimal(10, 2) := 0;
        ot_type_id uuid; toil_type_id uuid;
    BEGIN
        SELECT id INTO toil_type_id FROM leave_types WHERE code = 'TOIL';
        SELECT id INTO ot_type_id FROM leave_types WHERE code = 'OT';

        WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
          AND leave_type_id = toil_type_id;

        SELECT COALESCE(SUM(amount_hours), 0) INTO total_comp_cashout FROM leave_balance_adjustments
        WHERE employee_id = target_employee_id AND leave_type_code = 'TOIL' AND adjustment_type = 'CASHOUT';

        FOR i IN 0..full_years LOOP
            p_start := adjusted_join_dt + (i * interval '1 year');
            p_end := adjusted_join_dt + ((i + 1) * interval '1 year');
            p_label := CASE WHEN i = 0 THEN '一年以下' ELSE '滿 ' || i || ' 年' END;
            
            SELECT COALESCE(SUM(hours), 0) INTO p_entitlement_hours FROM leave_requests
            WHERE employee_id = target_employee_id AND status = 'APPROVED' AND (is_modified IS FALSE OR is_modified IS NULL)
              AND leave_type_id = ot_type_id AND start_date >= p_start AND start_date < p_end;
              
            SELECT COALESCE(SUM(amount_hours), 0) INTO p_weighted_avg_hours FROM leave_balance_adjustments
            WHERE employee_id = target_employee_id AND leave_type_code = 'TOIL' AND adjustment_type IN ('GRANT', 'CORRECTION')
              AND created_at >= p_start AND created_at < p_end;
            
            p_entitlement_hours := p_entitlement_hours + COALESCE(p_weighted_avg_hours, 0);
            comp_bucket_list := comp_bucket_list || jsonb_build_object(
                'label', p_label, 'start_date', p_start, 'end_date', p_end, 'entitlement', p_entitlement_hours
            );
        END LOOP;

        rem_used := total_comp_used;
        rem_cashout := total_comp_cashout;
        FOR bucket_record IN SELECT * FROM jsonb_to_recordset(comp_bucket_list) AS x(label text, start_date date, end_date date, entitlement decimal) LOOP
            alloc_used := LEAST(rem_used, bucket_record.entitlement);
            rem_used := rem_used - alloc_used;
            bucket_rem := bucket_record.entitlement - alloc_used;
            alloc_cashout := LEAST(rem_cashout, bucket_rem);
            rem_cashout := rem_cashout - alloc_cashout;
            bucket_rem := bucket_rem - alloc_cashout;
            calc_total_earned := calc_total_earned + bucket_record.entitlement;
            comp_periods_json := comp_periods_json || jsonb_build_object(
                'label', bucket_record.label, 'start_date', bucket_record.start_date, 'end_date', bucket_record.end_date,
                'entitlement', bucket_record.entitlement, 'used', alloc_used, 'cashout', alloc_cashout, 'remaining', bucket_rem
            );
        END LOOP;

        SELECT jsonb_agg(value) INTO comp_periods_json FROM (
            SELECT value FROM jsonb_array_elements(comp_periods_json) ORDER BY (value->>'start_date')::date DESC
        ) x;

        result := json_build_object(
            'annual', json_build_object(
                'entitlement', total_annual_entitlement, 'used', total_annual_used, 'cashout', total_annual_cashout,
                'remaining', (total_annual_entitlement - total_annual_used - total_annual_cashout),
                'periods', periods_json
            ),
            'compensatory', json_build_object(
                'entitlement', calc_total_earned, 'used', total_comp_used, 'cashout', total_comp_cashout,
                'remaining', (calc_total_earned - total_comp_used - total_comp_cashout),
                'periods', comp_periods_json
            )
        );
    END;
 
    RETURN result;
END;
$$ LANGUAGE plpgsql;

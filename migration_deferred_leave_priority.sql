-- migration_deferred_leave_priority.sql
-- 依勞動基準法施行細則第24-1條
-- 遞延至次年度之特別休假，於次年度請休特別休假時，應優先扣除遞延數額
-- 加班折算補休（TOIL/COMPENSATORY）亦依相同原則，優先扣除較舊年度額度
-- 執行日期：2026-05-11

CREATE OR REPLACE FUNCTION get_employee_leave_balances(target_employee_id uuid, target_date date DEFAULT CURRENT_DATE)
RETURNS json AS $$
DECLARE
    emp_record       record;
    join_dt          date;
    emp_std_hours    decimal(10, 2);
    suspension_days  int := 0;
    adjusted_join_dt date;

    -- Annual Leave totals (for summary card)
    total_annual_entitlement decimal(10, 2) := 0;
    total_annual_used        decimal(10, 2) := 0;
    total_annual_cashout     decimal(10, 2) := 0;

    -- 特休：由舊到新的毛資料陣列
    raw_annual_asc   jsonb := '[]'::jsonb;
    -- 特休：最終計算結果（由新到舊輸出）
    final_annual_desc jsonb := '[]'::jsonb;

    -- 補休：由舊到新的毛資料陣列
    raw_comp_asc     jsonb := '[]'::jsonb;
    -- 補休：最終計算結果（由新到舊輸出）
    final_comp_desc  jsonb := '[]'::jsonb;

    -- 通用迴圈變數
    p_start        date;
    p_end          date;
    p_days         int;
    p_entitlement  decimal(10, 2);
    p_used         decimal(10, 2);
    p_cashout      decimal(10, 2);
    full_years     int;
    i              int;

    -- 補休相關
    ot_type_ids        uuid[];
    comp_leave_type_id uuid;
    toil_type_id       uuid;
    ot_hours           decimal(10, 2);
    p_comp_earned      decimal(10, 2);
    p_comp_used        decimal(10, 2);
    p_comp_cashout     decimal(10, 2);
    periods_count      int;
    total_ot_hours     decimal(10, 2) := 0;

    -- 補休總計
    calc_total_earned  decimal(10, 2) := 0;
    calc_total_used    decimal(10, 2) := 0;
    calc_total_cashout decimal(10, 2) := 0;

    -- 遞延優先扣除計算（特休）
    arr_len         int;
    j               int;
    rec             jsonb;
    a_deferred_in   decimal(10, 2) := 0;
    a_entitlement   decimal(10, 2);
    a_used_raw      decimal(10, 2);
    a_cashout_val   decimal(10, 2);
    a_pool          decimal(10, 2);
    a_used_from_def decimal(10, 2);
    a_net_remaining decimal(10, 2);
    a_formula       text;

    -- 遞延優先扣除計算（補休）
    comp_arr_len    int;
    k               int;
    crec            jsonb;
    c_deferred_in   decimal(10, 2) := 0;
    c_entitlement   decimal(10, 2);
    c_used_raw      decimal(10, 2);
    c_cashout_val   decimal(10, 2);
    c_pool          decimal(10, 2);
    c_used_from_def decimal(10, 2);
    c_net_remaining decimal(10, 2);
    c_formula       text;

    -- 展延計算輔助
    a_next_deferred decimal(10, 2);
    c_next_deferred decimal(10, 2);

    -- 手動調整
    annual_granted decimal(10, 2);

    result json;
BEGIN
    SELECT * INTO emp_record FROM employees WHERE id = target_employee_id;
    IF emp_record IS NULL THEN
        RETURN json_build_object('error', 'Employee not found');
    END IF;

    emp_std_hours := COALESCE(emp_record.standard_daily_hours, 8.0);

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

    SELECT COALESCE(SUM(end_date - start_date + 1), 0) INTO suspension_days
    FROM seniority_suspensions
    WHERE employee_id = target_employee_id AND start_date <= target_date;

    adjusted_join_dt := join_dt + (suspension_days * interval '1 day');
    full_years := EXTRACT(YEAR FROM age(target_date, adjusted_join_dt));

    -- ══════════════════════════════════════════════════════════════
    -- STEP 1：特別休假 ── 蒐集各期間毛資料（由舊到新）
    -- ══════════════════════════════════════════════════════════════

    -- 最舊：滿 0.5 年
    IF age(target_date, adjusted_join_dt) >= interval '6 months' THEN
        p_start := adjusted_join_dt + interval '6 months';
        p_end   := adjusted_join_dt + interval '1 year';

        IF p_start >= '2017-01-01'::date THEN
            p_days        := 3;
            p_entitlement := p_days * emp_std_hours;

            raw_annual_asc := raw_annual_asc || jsonb_build_object(
                'label', '滿 0.5 年',
                'start_date', p_start, 'end_date', p_end,
                'entitlement', p_entitlement
            );

            total_annual_entitlement := total_annual_entitlement + p_entitlement;
        END IF;
    END IF;

    -- 各週年（由舊到新：i=1 到 full_years）
    IF full_years >= 1 THEN
        FOR i IN 1..full_years LOOP
            p_start := adjusted_join_dt + (i * interval '1 year');
            p_end   := adjusted_join_dt + ((i + 1) * interval '1 year');

            IF i = 1 THEN p_days := 7;
            ELSIF i = 2 THEN p_days := 10;
            ELSIF i >= 3 AND i < 5 THEN p_days := 14;
            ELSIF i >= 5 AND i < 10 THEN p_days := 15;
            ELSE p_days := LEAST(16 + (i - 10), 30);  -- 勞基法§38：滿10年=16日，每增1年加1日，上限30日
            END IF;

            p_entitlement := p_days * emp_std_hours;

            raw_annual_asc := raw_annual_asc || jsonb_build_object(
                'label', '滿 ' || i || ' 年',
                'start_date', p_start, 'end_date', p_end,
                'entitlement', p_entitlement
            );

            total_annual_entitlement := total_annual_entitlement + p_entitlement;
        END LOOP;
    END IF;

    -- 手動調整（GRANT/CORRECTION）納入總額
    SELECT COALESCE(SUM(amount_hours), 0) INTO annual_granted
    FROM leave_balance_adjustments
    WHERE employee_id = target_employee_id
      AND leave_type_code = 'ANNUAL'
      AND adjustment_type IN ('GRANT', 'CORRECTION');
    total_annual_entitlement := total_annual_entitlement + annual_granted;

    -- 總已用與折現（summary card 用）
    SELECT COALESCE(SUM(hours), 0) INTO total_annual_used
    FROM leave_requests
    WHERE employee_id = target_employee_id AND status = 'APPROVED'
      AND (is_modified IS FALSE OR is_modified IS NULL)
      AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ANNUAL');

    -- 包含手動調整與申請單形式的折現 (ALC)
    SELECT COALESCE(SUM(amount_hours), 0) INTO total_annual_cashout
    FROM leave_balance_adjustments
    WHERE employee_id = target_employee_id
      AND leave_type_code = 'ANNUAL' AND adjustment_type = 'CASHOUT';

    SELECT total_annual_cashout + COALESCE(SUM(hours), 0) INTO total_annual_cashout
    FROM leave_requests
    WHERE employee_id = target_employee_id AND status = 'APPROVED'
      AND (is_modified IS FALSE OR is_modified IS NULL)
      AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'ALC');

    -- ══════════════════════════════════════════════════════════════
    -- STEP 2：特別休假 ── 依第24-1條遞延優先扣除，由舊到新推算 (FIFO)
    -- ══════════════════════════════════════════════════════════════
    arr_len := jsonb_array_length(raw_annual_asc);
    a_deferred_in := 0;

    -- 使用全局總量進行 FIFO 分配
    DECLARE
        rem_annual_used    decimal(10, 2) := total_annual_used;
        rem_annual_cashout decimal(10, 2) := total_annual_cashout;
        a_alloc_used       decimal(10, 2);
        a_alloc_cashout    decimal(10, 2);
    BEGIN
        FOR j IN 0..(arr_len - 1) LOOP
            rec           := raw_annual_asc -> j;
            a_entitlement := (rec->>'entitlement')::decimal;

            -- 本期可用總量 = 前期遞延 + 本期應得
            a_pool := a_deferred_in + a_entitlement;

            -- 1. 分配請假 (Used) - 優先從 pool 扣除
            a_alloc_used := LEAST(a_pool, rem_annual_used);
            rem_annual_used := rem_annual_used - a_alloc_used;

            -- 2. 分配折現 (Cashout) - 從剩下的部分扣除
            a_alloc_cashout := LEAST(a_pool - a_alloc_used, rem_annual_cashout);
            rem_annual_cashout := rem_annual_cashout - a_alloc_cashout;

            -- 最終結餘
            a_net_remaining := a_pool - a_alloc_used - a_alloc_cashout;

            -- 下期遞延額度 (限本期應得部分)
            a_next_deferred := LEAST(a_entitlement, GREATEST(0, a_net_remaining));

            -- 記錄本期消耗自遞延的部分 (用於前端標籤顯示)
            a_used_from_def := LEAST(a_deferred_in, a_alloc_used);

            IF a_deferred_in > 0 THEN
                a_formula := '遞延 ' || a_deferred_in || ' + 應得 ' || a_entitlement
                          || ' − 已用 ' || a_alloc_used || ' − 折現 ' || a_alloc_cashout;
            ELSE
                a_formula := NULL;
            END IF;

            final_annual_desc := jsonb_build_object(
                'label',             rec->>'label',
                'start_date',        rec->>'start_date',
                'end_date',          rec->>'end_date',
                'entitlement',       a_entitlement,
                'deferred_in',       a_deferred_in,
                'used',              a_alloc_used,
                'used_from_deferred', a_used_from_def,
                'cashout',           a_alloc_cashout,
                'remaining',         a_net_remaining,
                'deferred_out',      a_next_deferred,
                'formula',           a_formula
            ) || final_annual_desc;

            a_deferred_in := a_next_deferred;
        END LOOP;
    END;

    -- ══════════════════════════════════════════════════════════════
    -- STEP 3：補休（加班折算）── 蒐集各期間毛資料（由舊到新）
    -- ══════════════════════════════════════════════════════════════
    SELECT array_agg(id) INTO ot_type_ids FROM leave_types WHERE code IN ('OT');
    SELECT id INTO comp_leave_type_id FROM leave_types WHERE code = 'COMPENSATORY';
    SELECT id INTO toil_type_id FROM leave_types WHERE code = 'TOIL';

    -- 計算全局總量 (Summary Card 與 FIFO 用)
    -- 1. 總生成 (OT/CO/ALC + Adjustments)
    SELECT COALESCE(SUM(hours), 0) INTO calc_total_earned
    FROM leave_requests
    WHERE employee_id = target_employee_id AND status = 'APPROVED'
      AND (is_modified IS FALSE OR is_modified IS NULL)
      AND leave_type_id = ANY(ot_type_ids);

    SELECT calc_total_earned + COALESCE(SUM(amount_hours), 0) INTO calc_total_earned
    FROM leave_balance_adjustments
    WHERE employee_id = target_employee_id
      AND leave_type_code IN ('TOIL', 'COMPENSATORY')
      AND adjustment_type IN ('GRANT', 'CORRECTION');

    -- 2. 總已用
    SELECT COALESCE(SUM(hours), 0) INTO calc_total_used
    FROM leave_requests
    WHERE employee_id = target_employee_id AND status = 'APPROVED'
      AND (is_modified IS FALSE OR is_modified IS NULL)
      AND leave_type_id IN (toil_type_id, comp_leave_type_id);

    -- 3. 總折算 (CASHOUT)
    SELECT COALESCE(SUM(amount_hours), 0) INTO calc_total_cashout
    FROM leave_balance_adjustments
    WHERE employee_id = target_employee_id
      AND leave_type_code IN ('TOIL', 'COMPENSATORY') AND adjustment_type = 'CASHOUT';

    -- 包含申請單形式的補休折現 (CO)
    SELECT calc_total_cashout + COALESCE(SUM(hours), 0) INTO calc_total_cashout
    FROM leave_requests
    WHERE employee_id = target_employee_id AND status = 'APPROVED'
      AND (is_modified IS FALSE OR is_modified IS NULL)
      AND leave_type_id IN (SELECT id FROM leave_types WHERE code = 'CO');

    periods_count := full_years + 1;

    FOR i IN 1..periods_count LOOP
        p_start := adjusted_join_dt + ((i - 1) * interval '1 year');
        p_end   := adjusted_join_dt + (i * interval '1 year');

        -- 期間加班生成
        SELECT COALESCE(SUM(hours), 0) INTO ot_hours
        FROM leave_requests
        WHERE employee_id = target_employee_id AND status = 'APPROVED'
          AND (is_modified IS FALSE OR is_modified IS NULL)
          AND leave_type_id = ANY(ot_type_ids)
          AND start_date >= p_start AND start_date < p_end;

        SELECT COALESCE(SUM(amount_hours), 0) INTO p_comp_earned
        FROM leave_balance_adjustments
        WHERE employee_id = target_employee_id
          AND leave_type_code IN ('TOIL', 'COMPENSATORY')
          AND adjustment_type IN ('GRANT', 'CORRECTION')
          AND created_at >= p_start AND created_at < p_end;

        p_comp_earned := p_comp_earned + ot_hours;

        raw_comp_asc := raw_comp_asc || jsonb_build_object(
            'label',      CASE WHEN i = 1 THEN '一年以下' ELSE '滿 ' || (i - 1) || ' 年' END,
            'start_date', p_start,
            'end_date',   p_end,
            'entitlement', p_comp_earned
        );
    END LOOP;

    -- ══════════════════════════════════════════════════════════════
    -- STEP 4：補休 ── 依第24-1條遞延優先扣除，由舊到新推算 (FIFO)
    -- ══════════════════════════════════════════════════════════════
    comp_arr_len  := jsonb_array_length(raw_comp_asc);
    c_deferred_in := 0;

    DECLARE
        rem_comp_used    decimal(10, 2) := calc_total_used;
        rem_comp_cashout decimal(10, 2) := calc_total_cashout;
        c_alloc_used     decimal(10, 2);
        c_alloc_cashout  decimal(10, 2);
    BEGIN
        FOR k IN 0..(comp_arr_len - 1) LOOP
            crec          := raw_comp_asc -> k;
            c_entitlement := (crec->>'entitlement')::decimal;

            c_pool := c_deferred_in + c_entitlement;

            -- 1. 分配請假
            c_alloc_used := LEAST(c_pool, rem_comp_used);
            rem_comp_used := rem_comp_used - c_alloc_used;

            -- 2. 分配折現
            c_alloc_cashout := LEAST(c_pool - c_alloc_used, rem_comp_cashout);
            rem_comp_cashout := rem_comp_cashout - c_alloc_cashout;

            c_net_remaining := c_pool - c_alloc_used - c_alloc_cashout;
            c_next_deferred := LEAST(c_entitlement, GREATEST(0, c_net_remaining));

            c_used_from_def := LEAST(c_deferred_in, c_alloc_used);

            IF c_deferred_in > 0 THEN
                c_formula := '遞延 ' || c_deferred_in || ' + 生成 ' || c_entitlement
                          || ' − 已用 ' || c_alloc_used || ' − 折算 ' || c_alloc_cashout;
            ELSE
                c_formula := NULL;
            END IF;

            final_comp_desc := jsonb_build_object(
                'label',              crec->>'label',
                'start_date',         crec->>'start_date',
                'end_date',           crec->>'end_date',
                'entitlement',        c_entitlement,
                'deferred_in',        c_deferred_in,
                'used',               c_alloc_used,
                'used_from_deferred', c_used_from_def,
                'cashout',            c_alloc_cashout,
                'remaining',          c_net_remaining,
                'deferred_out',       c_next_deferred,
                'formula',            c_formula
            ) || final_comp_desc;

            c_deferred_in := c_next_deferred;
        END LOOP;
    END;

    -- 加班總計（OT + CO + ALC）
    SELECT COALESCE(SUM(hours), 0) INTO total_ot_hours
    FROM leave_requests
    WHERE employee_id = target_employee_id AND status = 'APPROVED'
      AND (is_modified IS FALSE OR is_modified IS NULL)
      AND leave_type_id = ANY(ot_type_ids);

    -- ══════════════════════════════════════════════════════════════
    -- STEP 5：組裝最終 JSON 回傳
    -- ══════════════════════════════════════════════════════════════
    result := json_build_object(
        'annual', json_build_object(
            'entitlement', total_annual_entitlement,
            'used',        total_annual_used,
            'cashout',     total_annual_cashout,
            'remaining',   (total_annual_entitlement - total_annual_used - total_annual_cashout),
            'periods',     final_annual_desc
        ),
        'compensatory', json_build_object(
            'entitlement',    calc_total_earned,
            'used',           calc_total_used,
            'cashout',        calc_total_cashout,
            'remaining',      (calc_total_earned - calc_total_used - calc_total_cashout),
            'overtime_total', total_ot_hours,
            'periods',        final_comp_desc
        )
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

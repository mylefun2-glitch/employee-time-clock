-- Migration: Rename 週休三日 to 幸福日 and restore proportional ratio calculation
-- Date: 2026-07-23
-- Description: 
--   1. Changes the calculation logic back to proportional scaling based on actual days
--      (instead of flat 80%).
--   2. Renames all display text from 週休三日 to 幸福日.
--   Example: earning period 365 days with 100 happy days:
--     ratio = (265 + 100 * 0.8) / 365 = 345/365 ≈ 0.9452
--     detail_text = '(正常 265天 + 幸福日 100天 × 0.8) / 365天'

CREATE OR REPLACE FUNCTION calculate_four_day_workweek_ratio(target_employee_id uuid, p_start date, p_end date, OUT ratio decimal, OUT detail_text text)
AS $$
DECLARE
    total_days int;
    four_day_days int := 0;
    normal_days int;
BEGIN
    total_days := p_end - p_start;
    IF total_days <= 0 THEN
        ratio := 1.0;
        detail_text := '';
        RETURN;
    END IF;

    -- Calculate overlap days between [p_start, p_end) and four_day_workweek_periods
    SELECT COALESCE(SUM(
        LEAST(end_date, p_end - 1) - GREATEST(start_date, p_start) + 1
    ), 0) INTO four_day_days
    FROM four_day_workweek_periods
    WHERE employee_id = target_employee_id
      AND start_date < p_end
      AND end_date >= p_start;

    four_day_days := LEAST(four_day_days, total_days);
    normal_days := total_days - four_day_days;

    IF four_day_days > 0 THEN
        ratio := ROUND((normal_days + four_day_days * 0.8) / total_days::decimal, 4);
        detail_text := '(正常 ' || normal_days || '天 + 幸福日 ' || four_day_days || '天 × 0.8) / ' || total_days || '天';
    ELSE
        ratio := 1.0;
        detail_text := '';
    END IF;
END;
$$ LANGUAGE plpgsql;

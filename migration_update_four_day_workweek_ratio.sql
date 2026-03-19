-- Migration: Update Four-Day Workweek Ratio Calculation
-- Date: 2026-03-19
-- Description: Changes the calculation logic for four-day workweek special leave. If an employee has a four-day workweek schedule during the period, the entitlement is calculated at a flat 80% (0.8), without proportional scaling based on exact days.

CREATE OR REPLACE FUNCTION calculate_four_day_workweek_ratio(target_employee_id uuid, p_start date, p_end date, OUT ratio decimal, OUT detail_text text)
AS $$
DECLARE
    total_days int;
    four_day_days int := 0;
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

    IF four_day_days > 0 THEN
        ratio := 0.8;
        detail_text := '週休三日 80%';
    ELSE
        ratio := 1.0;
        detail_text := '';
    END IF;
END;
$$ LANGUAGE plpgsql;

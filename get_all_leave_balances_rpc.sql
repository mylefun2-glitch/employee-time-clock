CREATE OR REPLACE FUNCTION get_all_employees_leave_balances(target_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    employee_id uuid,
    balance json
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, get_employee_leave_balances(id, target_date)
    FROM employees
    WHERE is_active = true;
END;
$$ LANGUAGE plpgsql STABLE;

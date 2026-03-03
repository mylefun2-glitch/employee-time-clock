CREATE OR REPLACE FUNCTION diag_employee_leave_requests(target_employee_id uuid)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(x) INTO result FROM (
        SELECT 
            r.id, 
            r.start_date, 
            r.hours, 
            r.status, 
            r.type, 
            r.is_modified,
            t.code as leave_type_code,
            t.name as leave_type_name
        FROM leave_requests r
        LEFT JOIN leave_types t ON r.leave_type_id = t.id
        WHERE r.employee_id = target_employee_id
        ORDER BY r.start_date DESC
    ) x;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

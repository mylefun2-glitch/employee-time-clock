-- 診斷補登審核問題的 SQL 查詢

-- 1. 檢查員工資料和主管關係
select 
    id,
    name,
    department,
    pin,
    manager_id,
    (select name from employees where id = e.manager_id) as manager_name
from employees e
where name in ('林萁祥', '林文明')
order by name;

-- 2. 檢查補登申請記錄
select 
    mar.id,
    mar.created_at,
    mar.employee_id,
    e.name as employee_name,
    e.manager_id,
    (select name from employees where id = e.manager_id) as manager_name,
    mar.request_date,
    mar.check_type,
    mar.request_time,
    mar.reason,
    mar.status
from makeup_attendance_requests mar
join employees e on mar.employee_id = e.id
order by mar.created_at desc
limit 10;

-- 3. 檢查 RLS 政策
select 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
from pg_policies
where tablename = 'makeup_attendance_requests';

-- 4. 測試查詢（模擬主管查看）
-- 假設林文明的 ID 是 'MANAGER_ID'，請替換為實際的 UUID
-- select * from makeup_attendance_requests
-- where employee_id in (
--     select id from employees where manager_id = 'MANAGER_ID'
-- );

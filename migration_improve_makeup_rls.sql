-- 改進補登申請表的 RLS 政策
-- 此腳本將現有的寬鬆政策替換為更安全的政策

-- 首先刪除現有的政策
drop policy if exists "Enable read access for all users" on makeup_attendance_requests;
drop policy if exists "Enable insert for all users" on makeup_attendance_requests;
drop policy if exists "Enable update for all users" on makeup_attendance_requests;
drop policy if exists "Enable delete for all users" on makeup_attendance_requests;

-- 建立新的安全政策

-- 1. 員工可以查看自己的申請
create policy "Employees can view their own requests"
on makeup_attendance_requests for select
using (
  employee_id = auth.uid()
);

-- 2. 主管可以查看直屬下屬的申請
create policy "Managers can view subordinates requests"
on makeup_attendance_requests for select
using (
  exists (
    select 1 from employees
    where employees.id = makeup_attendance_requests.employee_id
    and employees.manager_id = auth.uid()
  )
);

-- 3. 員工可以建立自己的申請
create policy "Employees can create their own requests"
on makeup_attendance_requests for insert
with check (
  employee_id = auth.uid()
);

-- 4. 主管可以更新（審核）直屬下屬的申請
create policy "Managers can update subordinates requests"
on makeup_attendance_requests for update
using (
  exists (
    select 1 from employees
    where employees.id = makeup_attendance_requests.employee_id
    and employees.manager_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from employees
    where employees.id = makeup_attendance_requests.employee_id
    and employees.manager_id = auth.uid()
  )
);

-- 5. 系統管理員可以查看所有申請（選用）
-- 如果有 is_admin 欄位，可以新增此政策
-- create policy "Admins can view all requests"
-- on makeup_attendance_requests for select
-- using (
--   exists (
--     select 1 from employees
--     where employees.id = auth.uid()
--     and employees.is_admin = true
--   )
-- );

-- 注意：此腳本假設使用 Supabase Auth
-- 如果您的應用程式使用不同的認證方式，需要調整 auth.uid() 的使用

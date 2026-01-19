-- 修復補登申請表的 RLS 政策
-- 此腳本將解決員工無法提交補登申請的問題

-- 首先刪除現有的政策
drop policy if exists "Enable read access for all users" on makeup_attendance_requests;
drop policy if exists "Enable insert for all users" on makeup_attendance_requests;
drop policy if exists "Enable update for all users" on makeup_attendance_requests;
drop policy if exists "Enable delete for all users" on makeup_attendance_requests;

-- 建立新的寬鬆政策（適用於使用 PIN 碼登入的系統）
-- 注意：這些政策允許所有使用者進行操作，因為應用程式使用 PIN 碼而非 Supabase Auth

-- 1. 允許所有使用者查看補登申請
create policy "Allow all to view makeup requests"
on makeup_attendance_requests for select
using (true);

-- 2. 允許所有使用者建立補登申請
create policy "Allow all to create makeup requests"
on makeup_attendance_requests for insert
with check (true);

-- 3. 允許所有使用者更新補登申請（用於審核）
create policy "Allow all to update makeup requests"
on makeup_attendance_requests for update
using (true)
with check (true);

-- 4. 允許所有使用者刪除補登申請（可選）
create policy "Allow all to delete makeup requests"
on makeup_attendance_requests for delete
using (true);

-- 注意事項：
-- 1. 這些政策適用於使用匿名存取（anon key）的應用程式
-- 2. 實際的權限控制在應用程式層面進行（透過 employee_id 和 manager_id）
-- 3. 如果未來改用 Supabase Auth，需要更新這些政策以使用 auth.uid()

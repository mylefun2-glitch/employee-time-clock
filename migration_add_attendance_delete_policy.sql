-- 為 attendance_logs 表格新增刪除權限
create policy "Enable delete for all users" on attendance_logs for delete using (true);

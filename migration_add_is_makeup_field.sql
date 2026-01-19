-- 為 attendance_logs 表新增 is_makeup 欄位以標記補登記錄
alter table attendance_logs add column if not exists is_makeup boolean default false;

-- 為 is_makeup 欄位建立索引以加快查詢
create index if not exists idx_attendance_logs_is_makeup on attendance_logs(is_makeup);

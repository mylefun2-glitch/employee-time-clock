-- 增加員工個別出勤時段欄位
-- 執行日期：2026-01-29

ALTER TABLE employees 
ADD COLUMN work_start_time text DEFAULT '08:00',
ADD COLUMN work_end_time text DEFAULT '17:00',
ADD COLUMN break_start_time text DEFAULT '12:00',
ADD COLUMN break_end_time text DEFAULT '13:00';

-- 更新說明註解
COMMENT ON COLUMN employees.work_start_time IS '預定上班時間 (HH:mm)';
COMMENT ON COLUMN employees.work_end_time IS '預定下班時間 (HH:mm)';
COMMENT ON COLUMN employees.break_start_time IS '休息開始時間 (HH:mm)';
COMMENT ON COLUMN employees.break_end_time IS '休息結束時間 (HH:mm)';

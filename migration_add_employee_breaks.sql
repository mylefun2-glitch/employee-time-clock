-- 增加員工第二組休息時段欄位
-- 執行日期：2026-01-29

ALTER TABLE employees 
ADD COLUMN break2_start_time text DEFAULT NULL,
ADD COLUMN break2_end_time text DEFAULT NULL;

-- 更新說明註解
COMMENT ON COLUMN employees.break2_start_time IS '第二組休息開始時間 (HH:mm)';
COMMENT ON COLUMN employees.break2_end_time IS '第二組休息結束時間 (HH:mm)';

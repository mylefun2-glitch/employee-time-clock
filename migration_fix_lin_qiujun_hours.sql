-- migration_fix_lin_qiujun_hours.sql
-- 修正林秋君的每日工時設定，將其從 7 小時恢復為 8 小時，並更新下班時間為 17:00
-- 執行日期：2026-05-11

-- 1. 修正員工主表的每日工時與下班時間
UPDATE employees 
SET 
  standard_daily_hours = 8.0,
  work_end_time = '17:00'
WHERE name = '林秋君';

-- 2. 修正班表歷史紀錄（針對下班時間顯示為 16:00 且工時受限的紀錄）
UPDATE employee_schedules
SET 
  work_end_time = '17:00',
  standard_daily_hours = 8.0
WHERE employee_id = (SELECT id FROM employees WHERE name = '林秋君')
  AND work_end_time = '16:00';

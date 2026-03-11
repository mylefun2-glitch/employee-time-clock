-- 補齊 employees 資料表缺失的欄位，以支援班表設定
-- 執行日期：2026-03-11

-- 1. 新增 rest_days 欄位 (每週固定休息日)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rest_days INTEGER[] DEFAULT ARRAY[0, 6];
COMMENT ON COLUMN employees.rest_days IS '每週固定休息日 (0=日, 6=六)';

-- 2. 新增 salary_type 欄位 (薪資類型)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT 'MONTHLY' CHECK (salary_type IN ('MONTHLY', 'HOURLY'));
COMMENT ON COLUMN employees.salary_type IS '薪資類型 (MONTHLY/HOURLY)';

-- 3. 新增 schedule_effective_date 欄位 (班表生效日期 - 為了基礎資料完整性)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS schedule_effective_date DATE;
COMMENT ON COLUMN employees.schedule_effective_date IS '班表生效日期';

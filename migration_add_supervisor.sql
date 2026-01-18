-- 新增主管審核機制
-- 執行日期：2026-01-18

-- ============================================
-- 步驟 1: 在 employees 資料表新增 supervisor_id
-- ============================================

DO $$ 
BEGIN
    -- 新增主管欄位
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employees' 
        AND column_name = 'supervisor_id'
    ) THEN
        ALTER TABLE employees 
        ADD COLUMN supervisor_id UUID REFERENCES employees(id);
        
        RAISE NOTICE 'supervisor_id 欄位已新增';
    ELSE
        RAISE NOTICE 'supervisor_id 欄位已存在，跳過新增';
    END IF;
END $$;

-- ============================================
-- 步驟 2: 新增索引以提升查詢效能
-- ============================================

CREATE INDEX IF NOT EXISTS idx_employees_supervisor 
ON employees(supervisor_id);

-- ============================================
-- 步驟 3: 更新 leave_requests 視圖（包含主管資訊）
-- ============================================

-- 建立視圖以方便查詢請假申請及相關資訊
CREATE OR REPLACE VIEW leave_requests_with_supervisor AS
SELECT 
    lr.*,
    e.name as employee_name,
    e.department as employee_department,
    e.supervisor_id,
    s.name as supervisor_name,
    s.id as supervisor_employee_id
FROM leave_requests lr
LEFT JOIN employees e ON lr.employee_id = e.id
LEFT JOIN employees s ON e.supervisor_id = s.id;

-- ============================================
-- 驗證
-- ============================================

-- 顯示資料表結構
SELECT 
    column_name as 欄位名稱,
    data_type as 資料類型,
    is_nullable as 可為空
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'employees'
  AND column_name IN ('id', 'name', 'supervisor_id')
ORDER BY ordinal_position;

-- 顯示員工-主管關係（如果有資料）
SELECT 
    e.name as 員工,
    e.department as 部門,
    s.name as 主管
FROM employees e
LEFT JOIN employees s ON e.supervisor_id = s.id
ORDER BY e.department, e.name;

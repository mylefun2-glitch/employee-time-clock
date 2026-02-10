-- 新增多層級簽核機制
-- 執行日期：2026-02-10
-- 功能：支援請假 3 日（含）以上需要理事長審核

-- ============================================
-- 1. 為 employees 表新增理事長標記
-- ============================================
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS is_chairman BOOLEAN DEFAULT false;

-- 為理事長欄位建立索引
CREATE INDEX IF NOT EXISTS idx_employees_is_chairman ON employees(is_chairman) WHERE is_chairman = true;

COMMENT ON COLUMN employees.is_chairman IS '是否為理事長（用於多層級審核）';

-- ============================================
-- 2. 為 leave_requests 表新增多層級審核欄位
-- ============================================

-- 標記是否需要理事長審核
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS requires_chairman_approval BOOLEAN DEFAULT false;

-- 主管審核相關欄位
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS supervisor_approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS supervisor_approved_by UUID REFERENCES employees(id);

-- 理事長審核相關欄位
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS chairman_approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS chairman_approved_by UUID REFERENCES employees(id);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_leave_requests_requires_chairman 
ON leave_requests(requires_chairman_approval) 
WHERE requires_chairman_approval = true;

CREATE INDEX IF NOT EXISTS idx_leave_requests_supervisor_approved 
ON leave_requests(supervisor_approved_at) 
WHERE supervisor_approved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_chairman_approved 
ON leave_requests(chairman_approved_at) 
WHERE chairman_approved_at IS NOT NULL;

-- 新增註解說明
COMMENT ON COLUMN leave_requests.requires_chairman_approval IS '是否需要理事長審核（請假 >= 3 日）';
COMMENT ON COLUMN leave_requests.supervisor_approved_at IS '主管審核時間';
COMMENT ON COLUMN leave_requests.supervisor_approved_by IS '主管審核人 ID';
COMMENT ON COLUMN leave_requests.chairman_approved_at IS '理事長審核時間';
COMMENT ON COLUMN leave_requests.chairman_approved_by IS '理事長審核人 ID';

-- ============================================
-- 3. 驗證安裝
-- ============================================
SELECT 
    '新增欄位驗證' as 類別,
    column_name as 欄位名稱,
    data_type as 資料類型,
    is_nullable as 可為空
FROM information_schema.columns
WHERE table_name = 'employees' 
  AND column_name = 'is_chairman'
UNION ALL
SELECT 
    '新增欄位驗證' as 類別,
    column_name as 欄位名稱,
    data_type as 資料類型,
    is_nullable as 可為空
FROM information_schema.columns
WHERE table_name = 'leave_requests' 
  AND column_name IN (
    'requires_chairman_approval',
    'supervisor_approved_at',
    'supervisor_approved_by',
    'chairman_approved_at',
    'chairman_approved_by'
  )
ORDER BY 類別, 欄位名稱;

-- 新增申請變更功能相關欄位
-- 執行日期: 2026-02-07

-- 新增變更相關欄位到 leave_requests 表
ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS original_request_id uuid REFERENCES leave_requests(id),
ADD COLUMN IF NOT EXISTS is_modified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS modified_by_request_id uuid REFERENCES leave_requests(id),
ADD COLUMN IF NOT EXISTS modification_reason text;

-- 新增索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_leave_requests_original ON leave_requests(original_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_modified_by ON leave_requests(modified_by_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_is_modified ON leave_requests(is_modified) WHERE is_modified = true;

-- 驗證欄位已新增
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'leave_requests'
    AND column_name IN ('original_request_id', 'is_modified', 'modified_by_request_id', 'modification_reason')
ORDER BY column_name;

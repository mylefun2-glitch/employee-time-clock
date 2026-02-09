-- 新增職代欄位到 leave_requests 資料表
-- 執行日期: 2026-02-09

-- 新增 deputy_id 欄位
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS deputy_id uuid REFERENCES employees(id);

-- 新增註解
COMMENT ON COLUMN leave_requests.deputy_id IS '職務代理人 ID - 請假期間的工作代理人';

-- 驗證欄位是否新增成功
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'leave_requests' 
    AND column_name = 'deputy_id';

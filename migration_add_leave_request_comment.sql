-- 新增請假申請的審核備註欄位
-- 執行日期：2026-07-20

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS review_comment TEXT;

COMMENT ON COLUMN leave_requests.review_comment IS '審核備註（核准/拒絕時的附加說明）';

-- 檢查欄位是否新增成功
SELECT 
    '新增欄位驗證' as 類別,
    column_name as 欄位名稱,
    data_type as 資料類型
FROM information_schema.columns
WHERE table_name = 'leave_requests' 
  AND column_name = 'review_comment';

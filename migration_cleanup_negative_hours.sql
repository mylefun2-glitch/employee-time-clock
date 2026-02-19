-- 1. 數據清理：修復結束時間早於開始時間的錯誤資料
-- 將時數歸零，狀態設為 WITHDRAWN，並註記原因
UPDATE leave_requests 
SET 
  hours = 0, 
  status = 'WITHDRAWN', 
  reason = COALESCE(reason, '') || ' [系統自動修復：結束時間早於開始時間]'
WHERE end_date < start_date OR hours < 0;

-- 2. 新增資料表約束：防止未來再傳入無效的日期範圍
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_leave_dates'
    ) THEN
        ALTER TABLE leave_requests ADD CONSTRAINT check_leave_dates CHECK (end_date >= start_date);
    END IF;
END $$;

-- 3. 驗證清理結果
SELECT 
  employee_id, 
  COUNT(*) as fixed_count 
FROM leave_requests 
WHERE hours = 0 AND reason LIKE '%系統自動修復%' 
GROUP BY employee_id;

-- 增加 hours 欄位到 leave_requests 資料表
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS hours NUMERIC(10, 2);

-- 註釋欄位
COMMENT ON COLUMN leave_requests.hours IS '申請的總時數';

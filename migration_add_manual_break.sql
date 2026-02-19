-- 新增自定義休息時數欄位
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS manual_break_hours numeric(10,1) DEFAULT 0;

-- 註解說明
COMMENT ON COLUMN leave_requests.manual_break_hours IS '手動扣除的休息時數（例外情形）';

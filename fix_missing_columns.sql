-- 為 leave_requests 資料表補齊缺少的欄位
-- 1. 新增自定義休息時數欄位 (手動扣除時數)
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS manual_break_hours numeric(10,1) DEFAULT 0;
COMMENT ON COLUMN leave_requests.manual_break_hours IS '手動扣除的休息時數（例外情形）';

-- 2. 新增補行上班日欄位 (確保存在)
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_makeup_workday BOOLEAN DEFAULT false;
COMMENT ON COLUMN leave_requests.is_makeup_workday IS '是否為補行上班日（用於標記週末補班，使請假時數能正確計算）';

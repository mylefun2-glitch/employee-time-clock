-- 新增國定假日補假標記欄位
ALTER TABLE leave_requests ADD COLUMN is_makeup_holiday BOOLEAN DEFAULT false;

COMMENT ON COLUMN leave_requests.is_makeup_holiday IS '是否為手動標記的國定假日補假 (用於計算加班時數)';

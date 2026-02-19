-- 為 leave_requests 資料表新增 is_makeup_workday 欄位以支援補班日請假計算
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_makeup_workday BOOLEAN DEFAULT false;

-- 新增說明註釋
COMMENT ON COLUMN leave_requests.is_makeup_workday IS '是否為補行上班日（用於標記週末補班，使請假時數能正確計算）';

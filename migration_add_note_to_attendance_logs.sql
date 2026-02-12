-- 為 attendance_logs 表新增 note 欄位
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS note TEXT;

-- 確保 is_makeup 欄位也存在（以防之前的遷移未執行）
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS is_makeup BOOLEAN DEFAULT FALSE;

-- 為 is_makeup 建立索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_attendance_logs_is_makeup ON attendance_logs(is_makeup);

-- 為新欄位添加註釋
COMMENT ON COLUMN attendance_logs.note IS '補登記錄的備註資訊';
COMMENT ON COLUMN attendance_logs.is_makeup IS '是否為手動補登記錄';

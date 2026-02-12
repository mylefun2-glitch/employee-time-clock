-- 為 leave_requests 資料表新增附件相關欄位
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_drive_id TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_expires_at TIMESTAMP WITH TIME ZONE;

-- 為過期時間建立索引，優化定期清理任務
CREATE INDEX IF NOT EXISTS idx_leave_requests_attachment_expires ON leave_requests(attachment_expires_at);

-- 註釋欄位
COMMENT ON COLUMN leave_requests.attachment_drive_id IS 'Google Drive 檔案 ID';
COMMENT ON COLUMN leave_requests.attachment_name IS '原始檔案名稱';
COMMENT ON COLUMN leave_requests.attachment_url IS '檔案預覽連結';
COMMENT ON COLUMN leave_requests.attachment_expires_at IS '附件預計自動刪除時間';

-- ========================================================
-- Migration: Allow all access to leave_requests
-- Description: 重置 leave_requests 的 RLS 政策為 "Allow all access"，以確保後端管理者能讀取與管理所有人的差勤紀錄。
-- ========================================================

-- 1. 刪除所有可能衝突的舊政策
DROP POLICY IF EXISTS "Allow all access to leave_requests" ON leave_requests;
DROP POLICY IF EXISTS "Allow supervisors to read leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Enable all access for all users" ON leave_requests;

-- 2. 建立全新的寬鬆政策以確保管理員檢視無阻
CREATE POLICY "Allow all access to leave_requests"
ON leave_requests FOR ALL
USING (true)
WITH CHECK (true);

-- 3. 確保 RLS 已啟用
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

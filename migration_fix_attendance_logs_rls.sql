-- ============================================
-- 修正 attendance_logs 的 RLS 政策
-- 執行日期：2026-04-02
-- 說明：補足遺漏的 UPDATE 與 DELETE 政策
-- ============================================

-- 1. 啟用 UPDATE 政策（允許進行打卡記錄修改）
DROP POLICY IF EXISTS "Enable update for all users" ON attendance_logs;
CREATE POLICY "Enable update for all users" ON attendance_logs 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 2. 啟用 DELETE 政策（允許移除錯誤的打卡記錄）
DROP POLICY IF EXISTS "Enable delete for all users" ON attendance_logs;
CREATE POLICY "Enable delete for all users" ON attendance_logs 
FOR DELETE 
USING (true);

-- 3. 驗證目前政策
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd 
FROM pg_policies 
WHERE tablename = 'attendance_logs';

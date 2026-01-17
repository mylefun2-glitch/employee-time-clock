-- 全新安裝的完整資料庫架構
-- 適用於：刪除舊資料表後的全新安裝
-- 執行日期：2026-01-17

-- ============================================
-- 員工資料表
-- ============================================
CREATE TABLE employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  name text NOT NULL,
  pin text NOT NULL UNIQUE,
  department text,
  is_active boolean DEFAULT true
);

-- 啟用 RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 建立政策
CREATE POLICY "Enable read access for all users" ON employees FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON employees FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON employees FOR DELETE USING (true);

-- 插入測試資料
INSERT INTO employees (name, pin, department) VALUES
  ('張三', '800101', 'IT Dept'),
  ('李四', '900520', 'HR Dept');

-- ============================================
-- 考勤記錄資料表
-- ============================================
CREATE TABLE attendance_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  employee_id uuid REFERENCES employees(id) NOT NULL,
  check_type text NOT NULL CHECK (check_type IN ('IN', 'OUT')),
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 啟用 RLS
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- 建立政策
CREATE POLICY "Enable insert for all users" ON attendance_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable read access for all users" ON attendance_logs FOR SELECT USING (true);

-- ============================================
-- 差勤類型資料表
-- ============================================
CREATE TABLE leave_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  color text DEFAULT '#3B82F6',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0
);

-- 啟用 RLS
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

-- 建立政策
CREATE POLICY "Enable read access for all users" ON leave_types FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON leave_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON leave_types FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON leave_types FOR DELETE USING (true);

-- 插入預設差勤類型
INSERT INTO leave_types (name, code, color, sort_order) VALUES
  ('事假', 'PERSONAL', '#6366F1', 1),
  ('病假', 'SICK', '#EF4444', 2),
  ('特休', 'ANNUAL', '#10B981', 3),
  ('公假', 'OFFICIAL', '#F59E0B', 4),
  ('出差', 'BUSINESS_TRIP', '#3B82F6', 5);

-- ============================================
-- 請假申請資料表
-- ============================================
CREATE TABLE leave_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  employee_id uuid REFERENCES employees(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('LEAVE', 'BUSINESS_TRIP')),
  leave_type_id uuid REFERENCES leave_types(id),
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  reason text,
  status text DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approver_id uuid,
  approved_at timestamp with time zone
);

-- 啟用 RLS
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- 建立政策
CREATE POLICY "Enable all access for all users" ON leave_requests FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 驗證安裝
-- ============================================
SELECT 
  '資料表' as 類別,
  tablename as 名稱
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('employees', 'attendance_logs', 'leave_types', 'leave_requests')
ORDER BY tablename;

SELECT 
  '差勤類型' as 類別,
  name as 名稱,
  code as 代碼,
  color as 顏色
FROM leave_types
ORDER BY sort_order;

SELECT 
  '員工' as 類別,
  name as 名稱,
  department as 部門
FROM employees;

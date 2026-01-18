-- 擴展員工基本資料與保險資訊
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mailing_address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gmail TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS insurance_start_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS insurance_end_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('MALE', 'FEMALE', 'OTHER'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position TEXT;

-- 建立員工異動紀錄表
CREATE TABLE IF NOT EXISTS employee_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
    movement_type TEXT NOT NULL, -- 如：部門異動、職務調整、加薪、轉正等
    old_value TEXT,
    new_value TEXT,
    effective_date DATE DEFAULT CURRENT_DATE,
    reason TEXT,
    recorded_by UUID REFERENCES employees(id) -- 記錄人（管理員）
);

-- 開啟 RLS
ALTER TABLE employee_movements ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 政策
CREATE POLICY "允許所有人讀取異動紀錄" ON employee_movements FOR SELECT USING (true);
CREATE POLICY "允許所有人新增異動紀錄" ON employee_movements FOR INSERT WITH CHECK (true);
CREATE POLICY "允許所有人更新異動紀錄" ON employee_movements FOR UPDATE USING (true);
CREATE POLICY "允許所有人刪除異動紀錄" ON employee_movements FOR DELETE USING (true);

-- 註釋欄位
COMMENT ON COLUMN employees.birth_date IS '出生日期';
COMMENT ON COLUMN employees.mailing_address IS '通訊地址';
COMMENT ON COLUMN employees.contact_phone IS '電話（手機）';
COMMENT ON COLUMN employees.gmail IS 'Gmail';
COMMENT ON COLUMN employees.emergency_contact_name IS '緊急連絡人';
COMMENT ON COLUMN employees.emergency_contact_relationship IS '關係';
COMMENT ON COLUMN employees.emergency_contact_phone IS '緊急電話（手機）';
COMMENT ON COLUMN employees.insurance_start_date IS '加保日期';
COMMENT ON COLUMN employees.insurance_end_date IS '退保日期';
COMMENT ON COLUMN employees.join_date IS '入職日期（用於計算年資）';
COMMENT ON COLUMN employees.gender IS '性別';
COMMENT ON COLUMN employees.position IS '職務';

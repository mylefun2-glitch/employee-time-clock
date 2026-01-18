-- 建立公司資訊資料表
-- 執行日期：2026-01-18

-- ============================================
-- 建立 company_info 資料表
-- ============================================

CREATE TABLE IF NOT EXISTS company_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- 基本資訊
    company_name TEXT NOT NULL,           -- 公司抬頭
    tax_id TEXT,                          -- 統一編號
    phone TEXT,                           -- 電話
    contact_person TEXT,                  -- 負責人
    email TEXT,                           -- Email
    address TEXT,                         -- 地址
    
    -- 預設地點（主要辦公室）
    default_location_id UUID REFERENCES company_locations(id),
    
    -- 其他設定
    logo_url TEXT,                        -- 公司 Logo
    description TEXT,                     -- 公司簡介
    
    -- 系統設定
    is_active BOOLEAN DEFAULT true
);

-- 建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_info_updated_at BEFORE UPDATE ON company_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 啟用 RLS
ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;

-- 建立政策（允許所有使用者讀取和更新）
CREATE POLICY "Enable read access for all users" ON company_info FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON company_info FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON company_info FOR UPDATE USING (true);

-- 插入預設公司資訊
INSERT INTO company_info (
    company_name,
    tax_id,
    phone,
    contact_person,
    address,
    description
)
SELECT 
    '範例公司',
    '12345678',
    '02-1234-5678',
    '王大明',
    '台北市信義區信義路五段7號',
    '這是範例公司資訊，請修改為實際內容'
WHERE NOT EXISTS (SELECT 1 FROM company_info LIMIT 1);

-- 驗證
SELECT 
    company_name as 公司名稱,
    tax_id as 統編,
    phone as 電話,
    contact_person as 負責人
FROM company_info;

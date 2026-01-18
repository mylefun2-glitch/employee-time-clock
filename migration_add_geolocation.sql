-- 資料庫遷移腳本：新增打卡定位功能
-- 執行日期：2026-01-18
-- 說明：為現有的 attendance_logs 資料表新增地理位置欄位

-- ============================================
-- 步驟 1: 新增位置欄位到 attendance_logs
-- ============================================

DO $$ 
BEGIN
    -- 新增緯度欄位
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'attendance_logs' 
        AND column_name = 'latitude'
    ) THEN
        ALTER TABLE attendance_logs 
        ADD COLUMN latitude DECIMAL(10, 8);
        
        RAISE NOTICE 'latitude 欄位已新增';
    ELSE
        RAISE NOTICE 'latitude 欄位已存在，跳過新增';
    END IF;

    -- 新增經度欄位
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'attendance_logs' 
        AND column_name = 'longitude'
    ) THEN
        ALTER TABLE attendance_logs 
        ADD COLUMN longitude DECIMAL(11, 8);
        
        RAISE NOTICE 'longitude 欄位已新增';
    ELSE
        RAISE NOTICE 'longitude 欄位已存在，跳過新增';
    END IF;

    -- 新增定位精度欄位
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'attendance_logs' 
        AND column_name = 'location_accuracy'
    ) THEN
        ALTER TABLE attendance_logs 
        ADD COLUMN location_accuracy DECIMAL(10, 2);
        
        RAISE NOTICE 'location_accuracy 欄位已新增';
    ELSE
        RAISE NOTICE 'location_accuracy 欄位已存在，跳過新增';
    END IF;
END $$;

-- ============================================
-- 步驟 2: 建立公司位置設定資料表（可選）
-- ============================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_locations') THEN
        CREATE TABLE company_locations (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
            name TEXT NOT NULL,
            latitude DECIMAL(10, 8) NOT NULL,
            longitude DECIMAL(11, 8) NOT NULL,
            radius_meters INTEGER DEFAULT 100,
            is_active BOOLEAN DEFAULT true,
            description TEXT
        );
        
        RAISE NOTICE 'company_locations 資料表已建立';
    ELSE
        RAISE NOTICE 'company_locations 資料表已存在，跳過建立';
    END IF;
END $$;

-- ============================================
-- 步驟 3: 啟用 RLS 並設定政策
-- ============================================

ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;

-- 刪除舊政策（如果存在）
DROP POLICY IF EXISTS "Enable read access for all users" ON company_locations;
DROP POLICY IF EXISTS "Enable insert for all users" ON company_locations;
DROP POLICY IF EXISTS "Enable update for all users" ON company_locations;
DROP POLICY IF EXISTS "Enable delete for all users" ON company_locations;

-- 建立新政策
CREATE POLICY "Enable read access for all users" ON company_locations FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON company_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON company_locations FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON company_locations FOR DELETE USING (true);

-- ============================================
-- 步驟 4: 插入預設公司位置（範例）
-- ============================================

-- 注意：請根據實際公司位置修改以下座標
-- 這裡使用台北 101 作為範例座標

INSERT INTO company_locations (name, latitude, longitude, radius_meters, description)
SELECT '總公司', 25.0330, 121.5654, 100, '預設公司位置（請修改為實際座標）'
WHERE NOT EXISTS (SELECT 1 FROM company_locations WHERE name = '總公司');

-- ============================================
-- 完成！
-- ============================================

-- 驗證遷移結果
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'attendance_logs'
  AND column_name IN ('latitude', 'longitude', 'location_accuracy')
ORDER BY column_name;

-- 顯示公司位置設定
SELECT 
    name as 名稱,
    latitude as 緯度,
    longitude as 經度,
    radius_meters as 允許範圍_公尺,
    is_active as 啟用,
    description as 說明
FROM company_locations
WHERE is_active = true;

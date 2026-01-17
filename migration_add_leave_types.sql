-- 資料庫遷移腳本：為現有資料庫新增差勤類型功能
-- 執行日期：2026-01-17
-- 說明：此腳本會在不刪除現有資料的情況下，新增差勤類型管理功能

-- ============================================
-- 步驟 1: 建立 leave_types 資料表
-- ============================================

-- 檢查資料表是否已存在，如果不存在則建立
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_types') THEN
        CREATE TABLE leave_types (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
            name text NOT NULL,
            code text NOT NULL UNIQUE,
            color text DEFAULT '#3B82F6',
            is_active boolean DEFAULT true,
            sort_order integer DEFAULT 0
        );
        
        RAISE NOTICE 'leave_types 資料表已建立';
    ELSE
        RAISE NOTICE 'leave_types 資料表已存在，跳過建立';
    END IF;
END $$;

-- ============================================
-- 步驟 2: 啟用 RLS 並設定政策
-- ============================================

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

-- 刪除舊政策（如果存在）
DROP POLICY IF EXISTS "Enable read access for all users" ON leave_types;
DROP POLICY IF EXISTS "Enable insert for all users" ON leave_types;
DROP POLICY IF EXISTS "Enable update for all users" ON leave_types;
DROP POLICY IF EXISTS "Enable delete for all users" ON leave_types;

-- 建立新政策
CREATE POLICY "Enable read access for all users" ON leave_types FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON leave_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON leave_types FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON leave_types FOR DELETE USING (true);

-- ============================================
-- 步驟 3: 插入預設差勤類型（如果不存在）
-- ============================================

INSERT INTO leave_types (name, code, color, sort_order)
SELECT '事假', 'PERSONAL', '#6366F1', 1
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE code = 'PERSONAL');

INSERT INTO leave_types (name, code, color, sort_order)
SELECT '病假', 'SICK', '#EF4444', 2
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE code = 'SICK');

INSERT INTO leave_types (name, code, color, sort_order)
SELECT '特休', 'ANNUAL', '#10B981', 3
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE code = 'ANNUAL');

INSERT INTO leave_types (name, code, color, sort_order)
SELECT '公假', 'OFFICIAL', '#F59E0B', 4
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE code = 'OFFICIAL');

INSERT INTO leave_types (name, code, color, sort_order)
SELECT '出差', 'BUSINESS_TRIP', '#3B82F6', 5
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE code = 'BUSINESS_TRIP');

-- ============================================
-- 步驟 4: 更新 leave_requests 資料表
-- ============================================

-- 新增 leave_type_id 欄位（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leave_requests' 
        AND column_name = 'leave_type_id'
    ) THEN
        ALTER TABLE leave_requests 
        ADD COLUMN leave_type_id uuid REFERENCES leave_types(id);
        
        RAISE NOTICE 'leave_type_id 欄位已新增';
    ELSE
        RAISE NOTICE 'leave_type_id 欄位已存在，跳過新增';
    END IF;
END $$;

-- 新增 approved_at 欄位（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leave_requests' 
        AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE leave_requests 
        ADD COLUMN approved_at timestamp with time zone;
        
        RAISE NOTICE 'approved_at 欄位已新增';
    ELSE
        RAISE NOTICE 'approved_at 欄位已存在，跳過新增';
    END IF;
END $$;

-- ============================================
-- 步驟 5: 遷移現有資料（可選）
-- ============================================

-- 如果您有現有的 leave_requests 資料，可以執行以下腳本將舊的 type 對應到新的 leave_type_id
-- 注意：這會將 'LEAVE' 對應到 '事假'，'BUSINESS_TRIP' 對應到 '出差'

-- 更新 LEAVE 類型的申請
UPDATE leave_requests 
SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'PERSONAL' LIMIT 1)
WHERE type = 'LEAVE' AND leave_type_id IS NULL;

-- 更新 BUSINESS_TRIP 類型的申請
UPDATE leave_requests 
SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'BUSINESS_TRIP' LIMIT 1)
WHERE type = 'BUSINESS_TRIP' AND leave_type_id IS NULL;

-- ============================================
-- 完成！
-- ============================================

-- 驗證遷移結果
SELECT 
    '差勤類型總數' as 項目,
    COUNT(*)::text as 數量
FROM leave_types
UNION ALL
SELECT 
    '已遷移的申請記錄',
    COUNT(*)::text
FROM leave_requests
WHERE leave_type_id IS NOT NULL;

-- 顯示所有差勤類型
SELECT 
    name as 名稱,
    code as 代碼,
    color as 顏色,
    is_active as 啟用,
    sort_order as 排序
FROM leave_types
ORDER BY sort_order;

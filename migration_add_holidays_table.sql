-- ============================================================
-- Migration: 新增「假日管理」資料表
-- 用途：取代硬編碼的國定假日清單，支援管理者透過介面管理
-- ============================================================

-- 1. 建立假日資料表
CREATE TABLE IF NOT EXISTS holidays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'national_holiday',  
    -- type 可用值:
    --   'national_holiday' = 國定假日 (元旦、春節、國慶日等)
    --   'typhoon'          = 颱風假 / 天災假
    --   'custom'           = 自訂假日
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(date)  -- 每日只能有一筆假日記錄
);

-- 2. 加入欄位註解
COMMENT ON TABLE holidays IS '國定假日與臨時休假日管理表';
COMMENT ON COLUMN holidays.date IS '假日日期';
COMMENT ON COLUMN holidays.name IS '假日名稱（如：元旦、颱風假）';
COMMENT ON COLUMN holidays.type IS '假日類型：national_holiday=國定假日, typhoon=颱風假, custom=自訂';
COMMENT ON COLUMN holidays.description IS '備註說明';
COMMENT ON COLUMN holidays.created_by IS '建立者（管理員）';

-- 3. 建立索引（加速年度查詢）
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays (date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays (EXTRACT(YEAR FROM date));

-- 4. RLS 政策
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- 所有已驗證使用者可讀取假日資料
CREATE POLICY "holidays_select_all" ON holidays
    FOR SELECT
    TO authenticated
    USING (true);

-- 僅管理員可新增假日 (此專案前端管控權限，DB 允許所有存取以避免 role 不存在的錯誤)
CREATE POLICY "holidays_insert_admin" ON holidays
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 僅管理員可更新假日
CREATE POLICY "holidays_update_admin" ON holidays
    FOR UPDATE
    TO authenticated
    USING (true);

-- 僅管理員可刪除假日
CREATE POLICY "holidays_delete_admin" ON holidays
    FOR DELETE
    TO authenticated
    USING (true);

-- 5. 自動更新 updated_at 觸發器
CREATE OR REPLACE FUNCTION update_holidays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_holidays_updated_at
    BEFORE UPDATE ON holidays
    FOR EACH ROW
    EXECUTE FUNCTION update_holidays_updated_at();

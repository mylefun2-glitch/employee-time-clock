-- 建立挪移（調移）申請與生效系統
-- 執行日期: 2026-04-08

-- 1. 挪移申請表
CREATE TABLE IF NOT EXISTS shift_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- 挪移類型
    -- SWAP_REST_DAY: 休息日與工作日對調
    -- HOURS_ADJUSTMENT: 單日上班時間調整
    type TEXT NOT NULL CHECK (type IN ('SWAP_REST_DAY', 'HOURS_ADJUSTMENT')),
    
    -- 對調模式欄位
    original_rest_date DATE, -- 原本是休息日，現在要上班
    new_rest_date DATE,      -- 原本是工作日，現在要休息
    
    -- 時間調整模式欄位
    target_date DATE,
    new_work_start_time TEXT,
    new_work_end_time TEXT,
    new_break_start_time TEXT,
    new_break_end_time TEXT,
    
    reason TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
    
    approver_id UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    review_comment TEXT
);

-- 2. 員工日期覆蓋表 (生效紀錄)
-- 此表由程式在申請核准時自動維護
CREATE TABLE IF NOT EXISTS employee_day_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    override_date DATE NOT NULL,
    
    -- 覆蓋類型
    -- WORKDAY: 強制設為工作日 (不計加班)
    -- REST_DAY: 強制設為休息日 (計加班)
    -- CUSTOM_HOURS: 自定義工時
    day_type TEXT CHECK (day_type IN ('WORKDAY', 'REST_DAY', 'CUSTOM_HOURS')),
    
    -- 自定義時間 (僅在 CUSTOM_HOURS 或 WORKDAY 時有意義)
    work_start_time TEXT,
    work_end_time TEXT,
    break_start_time TEXT,
    break_end_time TEXT,
    
    request_id UUID REFERENCES shift_requests(id) ON DELETE SET NULL,
    
    UNIQUE(employee_id, override_date)
);

-- 加上索引
CREATE INDEX IF NOT EXISTS idx_shift_requests_employee ON shift_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_status ON shift_requests(status);
CREATE INDEX IF NOT EXISTS idx_day_overrides_lookup ON employee_day_overrides(employee_id, override_date);

-- 3. RLS 政策
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_day_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all" ON shift_requests FOR SELECT USING (true);
CREATE POLICY "Enable insert for all" ON shift_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all" ON shift_requests FOR UPDATE USING (true);

CREATE POLICY "Enable read for all" ON employee_day_overrides FOR SELECT USING (true);
CREATE POLICY "Enable insert for all" ON employee_day_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all" ON employee_day_overrides FOR UPDATE USING (true);

-- 4. 資料遷移 (選用：將舊有的補班標記轉入覆蓋表)
-- 由於舊有的 is_makeup_workday 是在 leave_requests 中，且通常是一次性的，
-- 我們可以考慮在查詢時動態合併，或在此處做初步遷移。
-- 這裡先保留遷移腳本，但不強制執行所有歷史紀錄，因為舊紀錄通常已隨申請完成。

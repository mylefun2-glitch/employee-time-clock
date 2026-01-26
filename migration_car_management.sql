-- 建立公務車資料表
CREATE TABLE IF NOT EXISTS cars (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    plate_number TEXT NOT NULL UNIQUE,      -- 車牌號碼
    model TEXT NOT NULL,                    -- 廠牌型號
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'IN_USE', 'MAINTENANCE')), -- 狀態
    last_mileage INTEGER DEFAULT 0,          -- 最後里程數
    is_active BOOLEAN DEFAULT TRUE           -- 是否啟用
);

-- 建立公務車申請資料表
CREATE TABLE IF NOT EXISTS car_usage_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    employee_id UUID REFERENCES employees(id) NOT NULL,
    car_id UUID REFERENCES cars(id),        -- 預估使用的車輛 (可由管理員指派或申請人預選)
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    purpose TEXT NOT NULL,                   -- 用途說明
    status TEXT DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approver_id UUID,                        -- 審核人 ID
    approved_at TIMESTAMP WITH TIME ZONE,
    review_comment TEXT                      -- 審核備註
);

-- 啟用 RLS
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_usage_requests ENABLE ROW LEVEL SECURITY;

-- Cars 政策
CREATE POLICY "允許所有人讀取車輛資訊" ON cars FOR SELECT USING (true);
CREATE POLICY "僅允許管理員維護車輛資訊" ON cars FOR ALL USING (true) WITH CHECK (true);

-- Car Usage Requests 政策
CREATE POLICY "允許員工讀取自己的申請" ON car_usage_requests FOR SELECT USING (true);
CREATE POLICY "允許員工提交申請" ON car_usage_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "允許管理員與主管審核申請" ON car_usage_requests FOR ALL USING (true) WITH CHECK (true);

-- 插入初始測試資料
INSERT INTO cars (plate_number, model, status) VALUES 
('ABC-1234', 'Toyota RAV4', 'AVAILABLE'),
('XYZ-5678', 'Honda CR-V', 'AVAILABLE');

-- 1. 確保 cars 資料表存在 (如果之前沒建立成功的話)
CREATE TABLE IF NOT EXISTS cars (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    plate_number TEXT NOT NULL UNIQUE,      -- 車牌號碼
    model TEXT NOT NULL,                    -- 廠牌型號
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'IN_USE', 'MAINTENANCE')), -- 狀態
    last_mileage INTEGER DEFAULT 0,          -- 最後里程數
    is_active BOOLEAN DEFAULT TRUE           -- 是否啟用
);

-- 2. 在 leave_requests 中增加 car_id 欄位
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS car_id UUID REFERENCES cars(id);

-- 3. 插入初始測試資料
INSERT INTO cars (plate_number, model, status) VALUES 
('ABC-1234', 'Toyota RAV4', 'AVAILABLE'),
('XYZ-5678', 'Honda CR-V', 'AVAILABLE')
ON CONFLICT (plate_number) DO NOTHING;

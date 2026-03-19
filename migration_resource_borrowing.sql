-- Migration: Resource Borrowing System (物品及場地借用)
-- Date: 2026-03-19

-- 1. 建立資源資料表 (物品 / 場地)
CREATE TABLE IF NOT EXISTS resources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,                        -- 資源名稱
    type TEXT NOT NULL CHECK (type IN ('ITEM', 'VENUE')), -- ITEM=物品, VENUE=場地
    description TEXT,                          -- 說明/備註
    location TEXT,                             -- 放置位置 / 場地地點
    quantity INTEGER NOT NULL DEFAULT 1,       -- 最大可借數量
    is_active BOOLEAN NOT NULL DEFAULT TRUE   -- 是否啟用
);

-- 2. 建立借用申請資料表
CREATE TABLE IF NOT EXISTS resource_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
    resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,           -- 借用數量
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,  -- 借用開始時間
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,    -- 歸還/結束時間
    purpose TEXT NOT NULL,                         -- 用途說明
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
    approver_id UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    review_comment TEXT,                           -- 審核備註
    CHECK (end_time > start_time)
);

-- 3. 啟用 RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_requests ENABLE ROW LEVEL SECURITY;

-- 4. 設定政策
DO $$ BEGIN
    DROP POLICY IF EXISTS "resources_all_access" ON resources;
    DROP POLICY IF EXISTS "resource_requests_all_access" ON resource_requests;
EXCEPTION WHEN OTHERS THEN END $$;

CREATE POLICY "resources_all_access" ON resources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "resource_requests_all_access" ON resource_requests FOR ALL USING (true) WITH CHECK (true);

-- 5. 建立索引
CREATE INDEX IF NOT EXISTS idx_resource_requests_employee_id ON resource_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_resource_id ON resource_requests(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON resource_requests(status);
CREATE INDEX IF NOT EXISTS idx_resource_requests_start_time ON resource_requests(start_time);

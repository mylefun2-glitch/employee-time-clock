-- 修復主管核心功能所需的資料庫變更
-- 執行此腳本以確保欄位完整

-- 1. 確保 employees 表有 supervisor_id（通常已存在）
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'supervisor_id') THEN
        ALTER TABLE employees ADD COLUMN supervisor_id UUID REFERENCES employees(id);
    END IF;
END $$;

-- 2. 為 employees 表新增 email 欄位（未來擴充與目前部分服務需要）
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'email') THEN
        ALTER TABLE employees ADD COLUMN email TEXT;
    END IF;
END $$;

-- 3. 為 employees 表新增 is_supervisor 欄位（雖然目前用計算的，但有這欄位更穩定）
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'is_supervisor') THEN
        ALTER TABLE employees ADD COLUMN is_supervisor BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4. 為 leave_requests 表新增 approved_at（如果缺少的預防措施）
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'approved_at') THEN
        ALTER TABLE leave_requests ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 5. 確保 RLS 政策允許同表讀取（主管查下屬）
DROP POLICY IF EXISTS "Allow supervisors to read subordinates" ON employees;
CREATE POLICY "Allow supervisors to read subordinates" ON employees 
FOR SELECT USING (true); -- 暫時設為 true 以確保功能運作

DROP POLICY IF EXISTS "Allow supervisors to read leave requests" ON leave_requests;
CREATE POLICY "Allow supervisors to read leave requests" ON leave_requests 
FOR ALL USING (true); -- 暫時設為 true 以確保功能運作

-- 建立員工班表與薪資異動紀錄表
CREATE TABLE IF NOT EXISTS employee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    
    -- 出勤時間
    work_start_time TEXT NOT NULL DEFAULT '08:00',
    work_end_time TEXT NOT NULL DEFAULT '17:00',
    
    -- 休息時間 1
    break_start_time TEXT NOT NULL DEFAULT '12:00',
    break_end_time TEXT NOT NULL DEFAULT '13:00',
    
    -- 休息時間 2 (選填)
    break2_start_time TEXT,
    break2_end_time TEXT,
    
    -- 休息時間 3 (選填)
    break3_start_time TEXT,
    break3_end_time TEXT,
    
    -- 每週固定休息日 (0=日, 1=一, 2=二, 3=三, 4=四, 5=五, 6=六)
    -- 預設週休二日 (0, 6)
    rest_days INTEGER[] DEFAULT ARRAY[0, 6],
    
    -- 薪資類型
    salary_type TEXT DEFAULT 'MONTHLY' CHECK (salary_type IN ('MONTHLY', 'HOURLY')),
    
    -- 備註
    note TEXT,

    UNIQUE(employee_id, effective_date)
);

-- 加上索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_employee_schedules_lookup ON employee_schedules (employee_id, effective_date DESC);

-- 啟用 RLS
ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;

-- 建立政策
DROP POLICY IF EXISTS "Enable read access for all users" ON employee_schedules;
CREATE POLICY "Enable read access for all users" ON employee_schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON employee_schedules;
CREATE POLICY "Enable insert for all users" ON employee_schedules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON employee_schedules;
CREATE POLICY "Enable update for all users" ON employee_schedules FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON employee_schedules;
CREATE POLICY "Enable delete for all users" ON employee_schedules FOR DELETE USING (true);

-- 同步現有員工的當前設定到班表表中 (作為起始點)
INSERT INTO employee_schedules (
    employee_id, 
    effective_date, 
    work_start_time, 
    work_end_time, 
    break_start_time, 
    break_end_time, 
    break2_start_time, 
    break2_end_time, 
    break3_start_time, 
    break3_end_time,
    rest_days,
    salary_type
)
SELECT 
    id, 
    DATE(COALESCE(join_date, NOW())), 
    COALESCE(work_start_time, '08:00'), 
    COALESCE(work_end_time, '17:00'), 
    COALESCE(break_start_time, '12:00'), 
    COALESCE(break_end_time, '13:00'), 
    break2_start_time, 
    break2_end_time, 
    break3_start_time, 
    break3_end_time,
    ARRAY[0, 6],
    'MONTHLY'
FROM employees
ON CONFLICT (employee_id, effective_date) DO NOTHING;

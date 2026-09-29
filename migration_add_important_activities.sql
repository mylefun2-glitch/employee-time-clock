-- 單位共同活動：獨立於既有差勤資料
CREATE TABLE IF NOT EXISTS important_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    activity_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('ALL', 'DEPARTMENTS', 'EMPLOYEES')),
    created_by UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT important_activities_time_order CHECK (end_time > start_time)
);

ALTER TABLE important_activities DROP CONSTRAINT IF EXISTS important_activities_scope_type_check;
ALTER TABLE important_activities ADD CONSTRAINT important_activities_scope_type_check
    CHECK (scope_type IN ('ALL', 'DEPARTMENTS', 'EMPLOYEES'));

CREATE TABLE IF NOT EXISTS important_activity_departments (
    activity_id UUID NOT NULL REFERENCES important_activities(id) ON DELETE CASCADE,
    department TEXT NOT NULL,
    PRIMARY KEY (activity_id, department)
);

CREATE TABLE IF NOT EXISTS important_activity_employees (
    activity_id UUID NOT NULL REFERENCES important_activities(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_important_activities_date
    ON important_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_important_activity_departments_department
    ON important_activity_departments(department);
CREATE INDEX IF NOT EXISTS idx_important_activity_employees_employee
    ON important_activity_employees(employee_id);

ALTER TABLE important_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE important_activity_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE important_activity_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "important activities read" ON important_activities;
DROP POLICY IF EXISTS "important activities insert" ON important_activities;
DROP POLICY IF EXISTS "important activities update" ON important_activities;
DROP POLICY IF EXISTS "important activities delete" ON important_activities;
CREATE POLICY "important activities read" ON important_activities FOR SELECT USING (true);
CREATE POLICY "important activities insert" ON important_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "important activities update" ON important_activities FOR UPDATE USING (true);
CREATE POLICY "important activities delete" ON important_activities FOR DELETE USING (true);

DROP POLICY IF EXISTS "important activity departments read" ON important_activity_departments;
DROP POLICY IF EXISTS "important activity departments insert" ON important_activity_departments;
DROP POLICY IF EXISTS "important activity departments delete" ON important_activity_departments;
CREATE POLICY "important activity departments read" ON important_activity_departments FOR SELECT USING (true);
CREATE POLICY "important activity departments insert" ON important_activity_departments FOR INSERT WITH CHECK (true);
CREATE POLICY "important activity departments delete" ON important_activity_departments FOR DELETE USING (true);

DROP POLICY IF EXISTS "important activity employees read" ON important_activity_employees;
DROP POLICY IF EXISTS "important activity employees insert" ON important_activity_employees;
DROP POLICY IF EXISTS "important activity employees delete" ON important_activity_employees;
CREATE POLICY "important activity employees read" ON important_activity_employees FOR SELECT USING (true);
CREATE POLICY "important activity employees insert" ON important_activity_employees FOR INSERT WITH CHECK (true);
CREATE POLICY "important activity employees delete" ON important_activity_employees FOR DELETE USING (true);

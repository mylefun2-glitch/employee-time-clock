-- Migration: Add Seniority Suspensions and Standard Daily Hours
-- Date: 2026-02-16

-- 1. Create table for seniority suspensions (e.g., unpaid leave, parental leave)
CREATE TABLE IF NOT EXISTS seniority_suspensions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    employee_id uuid REFERENCES employees(id) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE seniority_suspensions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable all access for all users" ON seniority_suspensions FOR ALL USING (true) WITH CHECK (true);

-- 2. Add standard daily hours to employees table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='standard_daily_hours') THEN
        ALTER TABLE employees ADD COLUMN standard_daily_hours numeric(4, 2) DEFAULT 8.0 NOT NULL;
    END IF;
END $$;

COMMENT ON COLUMN employees.standard_daily_hours IS '標準每日工時 (用於特休天數轉換成小時)';

-- ========================================================
-- Migration: Fix Withdraw Pending Status and RLS Policies
-- Description: 
-- 1. Updates the status check constraint to include 'WITHDRAW_PENDING'
-- 2. Resets RLS policies to allow anonymous users (PIN-based app) to manage requests
-- ========================================================

-- 1. Update status check constraint
DO $$
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;

    -- Add comprehensive constraint
    ALTER TABLE leave_requests 
    ADD CONSTRAINT leave_requests_status_check 
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'WITHDRAW_PENDING'));

    RAISE NOTICE 'Updated leave_requests_status_check constraint.';
END $$;

-- 2. Reset and simplify RLS policies
-- Since this application uses PIN codes for authentication and not Supabase Auth,
-- we use broad RLS policies and handle authorization at the application layer.

-- Disable RLS temporarily to clean up policies safely (optional but recommended)
-- ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;

-- Drop all existing specific policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all access for all users" ON leave_requests;
DROP POLICY IF EXISTS "Allow all access to leave_requests" ON leave_requests;
DROP POLICY IF EXISTS "Employees can view their own requests" ON leave_requests;
DROP POLICY IF EXISTS "Employees can create their own requests" ON leave_requests;

-- Create a single, clear policy for the kiosk/PIN mode
CREATE POLICY "Allow all access to leave_requests"
ON leave_requests FOR ALL
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    RAISE NOTICE 'Reset leave_requests RLS policies.';
END $$;

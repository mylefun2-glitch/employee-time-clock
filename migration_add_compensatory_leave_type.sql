-- Migration: Add 'COMPENSATORY' Leave Type
-- Date: 2026-02-13

-- Insert 'COMPENSATORY' (補休) into leave_types if it doesn't exist
INSERT INTO leave_types (name, code, color, sort_order)
SELECT '補休', 'COMPENSATORY', '#8B5CF6', 6
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE code = 'COMPENSATORY');

-- Verify
SELECT * FROM leave_types ORDER BY sort_order;

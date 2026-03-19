-- Migration: Fix Resource Requests Approver FK
-- Date: 2026-03-19
-- Description: Removes the foreign key constraint on approver_id since admin approvers are from auth.users, not the employees table.

ALTER TABLE resource_requests DROP CONSTRAINT IF EXISTS resource_requests_approver_id_fkey;

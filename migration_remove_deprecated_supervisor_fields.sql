-- 移除舊有的主管相關欄位
-- 警告：此操作不可逆，請確保所有主管關係已正確遷移至 manager_id 欄位

-- 1. 移除 supervisor_id 欄位（如果存在）
ALTER TABLE IF EXISTS employees 
DROP COLUMN IF EXISTS supervisor_id;

-- 2. 移除 is_supervisor 欄位（如果存在）
-- 注意：前端已修改為透過 manager_id 自動判斷主管身分，因此此欄位已不再需要
ALTER TABLE IF EXISTS employees 
DROP COLUMN IF EXISTS is_supervisor;

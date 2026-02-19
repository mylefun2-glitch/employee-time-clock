-- 新增 WITHDRAW_PENDING 狀態到 leave_requests 表
-- 此狀態用於撤回申請需經主管審核的流程

DO $$
BEGIN
    -- 刪除舊的檢查約束
    ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;

    -- 新增更完整的檢查約束
    ALTER TABLE leave_requests 
    ADD CONSTRAINT leave_requests_status_check 
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'WITHDRAW_PENDING'));
    
    RAISE NOTICE '已成功更新 leave_requests_status_check 以包含 WITHDRAW_PENDING';
END $$;

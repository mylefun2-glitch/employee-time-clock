-- 新增 WITHDRAWN 狀態到 leave_requests 表的 status 欄位

-- 檢查並更新 status 欄位的檢查約束
DO $$
BEGIN
    -- 刪除舊的檢查約束（如果存在）
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'leave_requests' 
        AND constraint_name LIKE '%status%check%'
    ) THEN
        ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
    END IF;

    -- 新增包含 WITHDRAWN 的檢查約束
    ALTER TABLE leave_requests 
    ADD CONSTRAINT leave_requests_status_check 
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'));
    
    RAISE NOTICE '已成功新增 WITHDRAWN 狀態到 leave_requests 表';
END $$;

-- 驗證更新
SELECT 
    constraint_name, 
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'leave_requests_status_check';

-- 1. 檢查是否存在 hours 欄位
-- 如果您無法直接在資料庫終端執行，請在 Supabase SQL Editor 執行此段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leave_requests' 
        AND column_name = 'hours'
    ) THEN
        ALTER TABLE leave_requests ADD COLUMN hours NUMERIC(10, 2);
        RAISE NOTICE 'hours 欄位已建立';
    END IF;
END $$;

-- 2. 回補現有資料的時數（選用）
-- 注意：這是一個簡單的估算，假設每天 8 小時。更精確的時數需要依據 start_date 和 end_date 計算。
-- 如果您希望現有的舊資料也能顯示時數，可以執行以下更新：
-- UPDATE leave_requests SET hours = 8 WHERE hours IS NULL AND status = 'APPROVED';

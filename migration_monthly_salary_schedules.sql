-- ============================================================
-- Migration: 薪制人員服務班表
-- 建立 monthly_salary_schedules 資料表，用於匯入月薪制員工每日班表
-- 欄位：員工、服務日期、班別、個案、服務時間（分鐘）、備註
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_salary_schedules (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    service_date  date NOT NULL,
    shift_type    text NOT NULL,             -- 班別：增-轉場 / 正常日班 / 休息日班 / 國定假日
    case_name     text NOT NULL DEFAULT '',  -- 個案姓名或自訂文字（設為 NOT NULL 配合唯一約束）
    service_mins  integer NOT NULL DEFAULT 0, -- 服務時間（分鐘）
    note          text,                      -- 備註
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE monthly_salary_schedules ENABLE ROW LEVEL SECURITY;

-- 允許管理員（已通過 auth）讀寫所有資料
CREATE POLICY "admin_full_access" ON monthly_salary_schedules
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_mss_employee_date
    ON monthly_salary_schedules (employee_id, service_date);

-- 移除唯一約束以支援同天多個相同個案或重複時段的服務記錄
-- 若先前已建立舊版資料表約束，做平滑升級移除
DO $$
BEGIN
    -- 1. 移除舊的唯一約束 (如果存在)
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_mss_employee_date_shift'
    ) THEN
        ALTER TABLE monthly_salary_schedules DROP CONSTRAINT uq_mss_employee_date_shift;
    END IF;

    -- 2. 移除新版的唯一約束 (如果存在)
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_mss_employee_date_shift_case'
    ) THEN
        ALTER TABLE monthly_salary_schedules DROP CONSTRAINT uq_mss_employee_date_shift_case;
    END IF;

    -- 3. 將 NULL 的 case_name 轉換為空字串，並設為 NOT NULL DEFAULT '' (維持非空以確保一致性)
    UPDATE monthly_salary_schedules SET case_name = '' WHERE case_name IS NULL;
    ALTER TABLE monthly_salary_schedules ALTER COLUMN case_name SET DEFAULT '';
    ALTER TABLE monthly_salary_schedules ALTER COLUMN case_name SET NOT NULL;
END $$;


-- 建立 updated_at 自動更新 trigger（如資料庫已有 update_updated_at_column 函式則直接套用）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_updated_at_monthly_salary_schedules'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
        ) THEN
            CREATE TRIGGER set_updated_at_monthly_salary_schedules
                BEFORE UPDATE ON monthly_salary_schedules
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END IF;
END;
$$;

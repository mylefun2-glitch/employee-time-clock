-- 新增員工登入帳號欄位
ALTER TABLE employees ADD COLUMN IF NOT EXISTS username TEXT;

-- 將現有員工的 username 預設設為其姓名 (name)
UPDATE employees SET username = name WHERE username IS NULL;

-- 加上唯一約束，確保帳號不重複
ALTER TABLE employees ADD CONSTRAINT employees_username_key UNIQUE (username);

-- 加上註釋
COMMENT ON COLUMN employees.username IS '員工登入帳號';

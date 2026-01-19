-- 為 employees 表新增部門主管標記欄位
alter table employees add column if not exists is_department_manager boolean default false;

-- 為部門主管欄位建立索引
create index if not exists idx_employees_is_department_manager on employees(is_department_manager);

-- 更新現有員工資料（可選：手動設定部門主管）
-- update employees set is_department_manager = true where id = 'xxx';

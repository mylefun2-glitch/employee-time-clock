-- 為 employees 表新增直屬主管欄位
alter table employees add column if not exists manager_id uuid references employees(id);

-- 為直屬主管欄位建立索引
create index if not exists idx_employees_manager_id on employees(manager_id);

-- 移除之前的部門主管欄位（如果已建立）
-- alter table employees drop column if exists is_department_manager;

-- 範例：設定員工的直屬主管
-- update employees set manager_id = '主管的UUID' where id = '員工的UUID';

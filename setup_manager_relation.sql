-- 設定員工的主管關係
-- 此腳本用於設定林萁祥的直屬主管為林文明

-- 步驟 1: 查詢兩位員工的 ID
-- 請先執行此查詢，記下兩位員工的 UUID
select id, name, department, pin 
from employees 
where name in ('林萁祥', '林文明')
order by name;

-- 步驟 2: 設定主管關係
-- 請將下方的 UUID 替換為實際的值

-- 範例（請替換為實際的 UUID）：
-- update employees 
-- set manager_id = '林文明的UUID' 
-- where name = '林萁祥';

-- 步驟 3: 驗證設定
-- 執行此查詢確認主管關係已正確設定
select 
    e.id,
    e.name as employee_name,
    e.department,
    e.manager_id,
    m.name as manager_name
from employees e
left join employees m on e.manager_id = m.id
where e.name = '林萁祥';

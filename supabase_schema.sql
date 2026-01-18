-- Create a table for employees
create table employees (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  pin text not null unique, -- 6 digit pin (birthday)
  department text,
  is_active boolean default true
);

-- Create a table for attendance logs
create table attendance_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  employee_id uuid references employees(id) not null,
  check_type text not null check (check_type in ('IN', 'OUT')),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  latitude decimal(10, 8),      -- 緯度
  longitude decimal(11, 8),     -- 經度
  location_accuracy decimal(10, 2)  -- 定位精度（公尺）
);

-- Enable Row Level Security (RLS)
alter table employees enable row level security;
alter table attendance_logs enable row level security;

-- Create policies
-- Note: For a true kiosk mode without user login, we might need to allow public insert/select
-- OR use a service role key on the backend (but this is a client-side app).
-- For this demo, we will allow ANON access to read employees (to check PIN) and insert logs.
-- IN PRODUCTION: You should use a Postgres Function to verify PIN and insert log to avoid exposing the PIN table to the public.

create policy "Enable read access for all users" on employees for select using (true);
create policy "Enable insert for all users" on employees for insert with check (true);
create policy "Enable update for all users" on employees for update using (true);
create policy "Enable delete for all users" on employees for delete using (true);

create policy "Enable insert for all users" on attendance_logs for insert with check (true);
create policy "Enable read access for all users" on attendance_logs for select using (true);

-- Insert some dummy data for testing
insert into employees (name, pin, department) values
('張三', '800101', 'IT Dept'),
('李四', '900520', 'HR Dept');

-- Create a table for leave/trip requests
create table leave_requests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  employee_id uuid references employees(id) not null,
  type text not null check (type in ('LEAVE', 'BUSINESS_TRIP')),
  leave_type_id uuid references leave_types(id),  -- 新增：參照差勤類型
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  reason text,
  status text default 'PENDING' not null check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  approver_id uuid, -- Simplified: removed reference to employees(id)
  approved_at timestamp with time zone
);

-- Enable Row Level Security (RLS)
alter table leave_requests enable row level security;

-- Create policies for leave_requests
create policy "Enable all access for all users" on leave_requests for all using (true) with check (true);

-- Create a table for leave types (差勤類型管理)
create table leave_types (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,              -- 類型名稱（如：事假、病假）
  code text not null unique,        -- 類型代碼（如：PERSONAL、SICK）
  color text default '#3B82F6',     -- 顯示顏色（hex color）
  is_active boolean default true,   -- 是否啟用
  sort_order integer default 0      -- 排序順序
);

-- Enable Row Level Security (RLS)
alter table leave_types enable row level security;

-- Create policies for leave_types
create policy "Enable read access for all users" on leave_types for select using (true);
create policy "Enable insert for all users" on leave_types for insert with check (true);
create policy "Enable update for all users" on leave_types for update using (true);
create policy "Enable delete for all users" on leave_types for delete using (true);

-- Insert default leave types (預設差勤類型)
insert into leave_types (name, code, color, sort_order) values
  ('事假', 'PERSONAL', '#6366F1', 1),
  ('病假', 'SICK', '#EF4444', 2),
  ('特休', 'ANNUAL', '#10B981', 3),
  ('公假', 'OFFICIAL', '#F59E0B', 4),
  ('出差', 'BUSINESS_TRIP', '#3B82F6', 5);


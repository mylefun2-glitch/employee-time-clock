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
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
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

create policy "Enable insert for all users" on attendance_logs for insert with check (true);
create policy "Enable read access for all users" on attendance_logs for select using (true);

-- Insert some dummy data for testing
insert into employees (name, pin, department) values
('張三', '800101', 'IT Dept'),
('李四', '900520', 'HR Dept');

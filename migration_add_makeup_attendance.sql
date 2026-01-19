-- 建立補登打卡申請表
create table makeup_attendance_requests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  employee_id uuid references employees(id) not null,
  request_date date not null,
  check_type text not null check (check_type in ('IN', 'OUT')),
  request_time time not null,
  reason text not null,
  status text default 'PENDING' not null check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reviewer_id uuid,
  reviewed_at timestamp with time zone,
  review_comment text
);

-- Enable Row Level Security (RLS)
alter table makeup_attendance_requests enable row level security;

-- Create policies
create policy "Enable read access for all users" on makeup_attendance_requests for select using (true);
create policy "Enable insert for all users" on makeup_attendance_requests for insert with check (true);
create policy "Enable update for all users" on makeup_attendance_requests for update using (true);
create policy "Enable delete for all users" on makeup_attendance_requests for delete using (true);

-- Create index for faster queries
create index idx_makeup_requests_employee on makeup_attendance_requests(employee_id);
create index idx_makeup_requests_status on makeup_attendance_requests(status);
create index idx_makeup_requests_date on makeup_attendance_requests(request_date);

-- 新版掃臉打卡系統資料表
-- 僅建立新表，不修改原始 attendance_logs / employees 資料結構。

create extension if not exists pgcrypto;

create table if not exists public.face_employee_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique,
  name text not null,
  department text,
  descriptor jsonb not null default '[]'::jsonb,
  reference_image_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_face_employee_profiles_employee_id on public.face_employee_profiles (employee_id);
create index if not exists idx_face_employee_profiles_is_active on public.face_employee_profiles (is_active);

create table if not exists public.face_attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  check_type text not null check (check_type in ('IN', 'OUT')),
  timestamp timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  match_distance double precision,
  reference_profile_id uuid references public.face_employee_profiles (id) on delete set null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_face_attendance_logs_employee_id on public.face_attendance_logs (employee_id);
create index if not exists idx_face_attendance_logs_timestamp on public.face_attendance_logs (timestamp desc);
create index if not exists idx_face_attendance_logs_check_type on public.face_attendance_logs (check_type);

-- Optional read-only link back to original employees table for lookup only.
-- Do not add foreign keys here to keep the new system isolated.

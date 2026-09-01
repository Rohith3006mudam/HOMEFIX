-- HOMEFIX Complete Schema Migration
-- Adds all tables needed for multi-role functionality
-- Safe to run multiple times; uses CREATE IF NOT EXISTS pattern

create extension if not exists pgcrypto;

-- =====================================================================
-- Update profiles table: add employee-specific fields
-- =====================================================================

alter table public.profiles add column if not exists approval_status text 
  default 'approved' check (approval_status in ('pending', 'approved', 'rejected', 'suspended'));

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists profile_photo_url text;
alter table public.profiles add column if not exists average_rating numeric(3,2) default 5.00;
alter table public.profiles add column if not exists total_jobs integer default 0;
alter table public.profiles add column if not exists is_online boolean default false;

-- Create index on approval_status for faster employee lookups
create index if not exists profiles_role_approval_status_idx 
  on public.profiles(role, approval_status);

-- =====================================================================
-- service_categories table
-- =====================================================================
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon_url text,
  display_order integer default 0,
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_categories_active_idx on public.service_categories(active);

-- =====================================================================
-- services table
-- =====================================================================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  name text not null,
  description text,
  image text,
  base_price numeric not null check (base_price > 0),
  duration_minutes integer default 120,
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_category_id_idx on public.services(category_id);
create index if not exists services_active_idx on public.services(active);

-- =====================================================================
-- employee_profiles table (extended employee info)
-- =====================================================================
create table if not exists public.employee_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  service_categories text[] default '{}', -- array of category names or IDs
  experience_years integer default 0,
  service_area text, -- geographic area
  hourly_rate numeric, -- optional per-hour rate
  service_rate numeric, -- optional service-specific rate
  availability_status text default 'available' check (availability_status in ('available', 'busy', 'offline')),
  documents jsonb default '{}', -- certification/verification docs
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_profiles_availability_idx 
  on public.employee_profiles(availability_status);

-- =====================================================================
-- bookings table enhancements (already exist but ensure all columns)
-- =====================================================================
alter table public.bookings add column if not exists service_id uuid 
  references public.services(id);
alter table public.bookings add column if not exists category_id uuid 
  references public.service_categories(id);
alter table public.bookings add column if not exists notes text;
alter table public.bookings add column if not exists customer_notes text;
alter table public.bookings add column if not exists professional_notes text;

-- Update bookings RLS policies to prevent unauthorized access
drop policy if exists "bookings admin read" on public.bookings;
create policy "bookings admin read"
on public.bookings for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- =====================================================================
-- reviews table for customer ratings of professionals
-- =====================================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade unique,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_professional_id_idx on public.reviews(professional_id);
create index if not exists reviews_customer_id_idx on public.reviews(customer_id);
create index if not exists reviews_booking_id_idx on public.reviews(booking_id);

alter table public.reviews enable row level security;

drop policy if exists "reviews select by any" on public.reviews;
drop policy if exists "reviews insert customer" on public.reviews;

create policy "reviews select by any"
on public.reviews for select
using (true);

create policy "reviews insert customer"
on public.reviews for insert
with check (customer_id = auth.uid());

create policy "reviews update customer"
on public.reviews for update
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

-- =====================================================================
-- notifications table
-- =====================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- 'booking_created', 'job_assigned', 'job_accepted', etc.
  title text not null,
  message text,
  related_booking_id uuid references public.bookings(id) on delete cascade,
  is_read boolean default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_is_read_idx on public.notifications(is_read);

alter table public.notifications enable row level security;

drop policy if exists "notifications own user read" on public.notifications;
drop policy if exists "notifications system insert" on public.notifications;

create policy "notifications own user read"
on public.notifications for select
using (user_id = auth.uid());

-- System functions can insert notifications (via database function)
create policy "notifications system insert"
on public.notifications for insert
with check (true);

-- =====================================================================
-- employee_locations table (update for accuracy)
-- =====================================================================
-- This table may already exist from employeeLocation.js, but ensure it has all columns
create table if not exists public.employee_locations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy numeric,
  heading numeric,
  speed numeric,
  is_online boolean default true,
  created_at timestamptz not null default now()
);

create index if not exists employee_locations_employee_id_idx on public.employee_locations(employee_id);
create index if not exists employee_locations_booking_id_idx on public.employee_locations(booking_id);

alter table public.employee_locations enable row level security;

drop policy if exists "employee_locations own and assigned" on public.employee_locations;
drop policy if exists "employee_locations customer read assigned" on public.employee_locations;
drop policy if exists "employee_locations admin read" on public.employee_locations;
drop policy if exists "employee_locations insert own" on public.employee_locations;

-- Employees can read and insert their own locations
create policy "employee_locations employee read write"
on public.employee_locations for select
using (
  employee_id = auth.uid()
  or (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.customer_id = auth.uid()
    ) and is_online = true
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "employee_locations insert own"
on public.employee_locations for insert
with check (employee_id = auth.uid());

-- =====================================================================
-- payments table (optional - for tracking payment status)
-- =====================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade unique,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  currency text default 'INR',
  method text not null, -- 'upi', 'card', 'wallet', 'cash'
  status text not null default 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  transaction_id text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists payments_customer_id_idx on public.payments(customer_id);
create index if not exists payments_status_idx on public.payments(status);

alter table public.payments enable row level security;

drop policy if exists "payments read own" on public.payments;
drop policy if exists "payments insert own" on public.payments;

create policy "payments read own"
on public.payments for select
using (
  customer_id = auth.uid()
  or exists (
    select 1 from public.bookings b 
    where b.id = booking_id and b.professional_id = auth.uid()
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "payments insert own"
on public.payments for insert
with check (customer_id = auth.uid());

-- =====================================================================
-- seed service categories and some sample services
-- =====================================================================
insert into public.service_categories (name, description, display_order, active)
values
  ('Plumbing', 'Plumbing repairs and installations', 1, true),
  ('Electrical', 'Electrical work and repairs', 2, true),
  ('Cleaning', 'Home and office cleaning services', 3, true),
  ('AC Service', 'Air conditioning service and repair', 4, true),
  ('Appliance Repair', 'Repair of household appliances', 5, true),
  ('Carpentry', 'Woodwork and carpentry services', 6, true),
  ('Painting', 'Interior and exterior painting', 7, true),
  ('Pest Control', 'Pest control and management', 8, true),
  ('Bathroom Cleaning', 'Specialized bathroom deep cleaning', 9, true),
  ('Maintenance', 'General home maintenance', 10, true)
on conflict (name) do nothing;

-- =====================================================================
-- Verify the schema
-- =====================================================================
-- Run these queries to verify all tables were created:
-- select table_name from information_schema.tables where table_schema = 'public' order by table_name;
-- 
-- To promote a user to admin after they sign up:
-- update public.profiles set role = 'admin' where email = 'admin@example.com';
-- 
-- To approve an employee:
-- update public.profiles set role = 'employee', approval_status = 'approved' 
-- where email = 'employee@example.com';

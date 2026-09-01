-- HOMEFIX corrective migration #2.
-- Purpose: make service_categories and approval_status columns
-- self-healing regardless of which of the previous migration files
-- (homefix_schema.sql, 001-005) were actually applied and in what order.
-- This fixes two observed production errors:
--   1. "relation public.service_categories does not exist" /
--      "column service_categories.description (or display_order/active)
--      does not exist" - caused by 001 creating a narrower version of the
--      table (id, name, sort_order) while 003/005 assumed a wider version
--      (id, name, description, icon_url, display_order, active) and used
--      CREATE TABLE IF NOT EXISTS, which is a no-op once the table exists.
--   2. "column p2.approval_status does not exist" - caused by 004's
--      driver_profiles policy referencing profiles.approval_status before
--      that column had necessarily been added.
--
-- Safe to run multiple times. Never drops tables/columns and never
-- deletes existing rows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. service_categories: guarantee the table and every column used by
--    the app/migrations exist, no matter which earlier script ran first.
-- ---------------------------------------------------------------------
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.service_categories add column if not exists description text;
alter table public.service_categories add column if not exists icon_url text;
alter table public.service_categories add column if not exists sort_order int not null default 0;
alter table public.service_categories add column if not exists display_order integer not null default 0;
alter table public.service_categories add column if not exists active boolean not null default true;
alter table public.service_categories add column if not exists updated_at timestamptz not null default now();

create index if not exists service_categories_active_idx on public.service_categories(active);

alter table public.service_categories enable row level security;

drop policy if exists "categories public read" on public.service_categories;
create policy "categories public read"
on public.service_categories for select
using (true);

drop policy if exists "categories admin write" on public.service_categories;
create policy "categories admin write"
on public.service_categories for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Re-seed the full category list; safe no-op for names that already exist.
insert into public.service_categories (name, description, display_order, active)
values
  ('plumbing', 'Plumbing and sanitary repairs', 1, true),
  ('electrical', 'Electrical wiring and repairs', 2, true),
  ('AC', 'Air conditioning service and repair', 3, true),
  ('cleaning', 'Home cleaning and deep cleaning', 4, true),
  ('carpenter', 'Carpentry and furniture work', 5, true),
  ('painter', 'Painting and wall finishing', 6, true),
  ('pest control', 'Pest and termite control', 7, true),
  ('appliance repair', 'Appliance repair and diagnostics', 8, true),
  ('bike mechanic', 'Bike repair and roadside assistance', 9, true),
  ('car mechanic', 'Car repair and roadside assistance', 10, true)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 2. profiles.approval_status: guarantee it exists (and is populated)
--    before any policy anywhere in the project references it.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists approval_status text default 'approved';

update public.profiles
set approval_status = 'approved'
where approval_status is null;

alter table public.profiles drop constraint if exists profiles_approval_status_check;

alter table public.profiles
  add constraint profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected', 'suspended')) not valid;

alter table public.profiles validate constraint profiles_approval_status_check;

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'employee', 'driver', 'admin')) not valid;

update public.profiles
set role = 'customer'
where role is null or role not in ('customer', 'employee', 'driver', 'admin');

alter table public.profiles validate constraint profiles_role_check;

-- ---------------------------------------------------------------------
-- 3. driver_profiles.approval_status: guarantee it exists before the
--    "customers read approved" policy (defined in 004/005) is (re)created.
-- ---------------------------------------------------------------------
alter table public.driver_profiles add column if not exists approval_status text default 'approved';

update public.driver_profiles
set approval_status = 'approved'
where approval_status is null;

drop policy if exists "driver_profiles customers read approved" on public.driver_profiles;
create policy "driver_profiles customers read approved"
on public.driver_profiles for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'customer'
  )
  and exists (
    select 1 from public.profiles p2
    where p2.id = driver_profiles.id
      and p2.role = 'driver'
      and coalesce(driver_profiles.approval_status, 'approved') = 'approved'
  )
);

-- ---------------------------------------------------------------------
-- 4. Verification queries (run manually after applying this migration)
-- ---------------------------------------------------------------------
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'service_categories'
-- order by ordinal_position;
--
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name in ('profiles', 'driver_profiles')
--   and column_name = 'approval_status';


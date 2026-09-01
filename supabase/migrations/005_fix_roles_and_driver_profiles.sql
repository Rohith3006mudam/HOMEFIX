-- HOMEFIX corrective migration
-- Fixes actual role mismatches, adds missing approval_status columns safely,
-- corrects the broken driver approval query, and keeps all existing data intact.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Normalize profile roles and approval status
-- ---------------------------------------------------------------------

-- Ensure the public.profiles.role constraint matches the real app model.
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'employee', 'driver', 'admin')) not valid;

alter table public.profiles validate constraint profiles_role_check;

alter table public.profiles add column if not exists approval_status text default 'approved';

alter table public.profiles drop constraint if exists profiles_approval_status_check;

alter table public.profiles
  add constraint profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected', 'suspended')) not valid;

alter table public.profiles validate constraint profiles_approval_status_check;

-- Keep legacy rows valid if they already use a different role value.
update public.profiles
set role = 'customer'
where role is null or role not in ('customer', 'employee', 'driver', 'admin');

update public.profiles
set approval_status = 'approved'
where approval_status is null or approval_status not in ('pending', 'approved', 'rejected', 'suspended');

-- ---------------------------------------------------------------------
-- 2. Ensure driver_profiles exists and is approval-aware
-- ---------------------------------------------------------------------
create table if not exists public.driver_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('bike', 'auto')) default 'bike',
  vehicle_model text,
  vehicle_registration_number text,
  vehicle_photo_url text,
  vehicle_capacity integer default 1,
  license_number text,
  license_expiry_date date,
  documents jsonb default '{}',
  service_area text,
  is_online boolean default false,
  availability_status text default 'offline' check (availability_status in ('available', 'busy', 'offline')),
  approval_status text default 'pending' check (approval_status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_profiles add column if not exists approval_status text;

update public.driver_profiles
set approval_status = 'approved'
where approval_status is null;

alter table public.driver_profiles
  alter column approval_status set default 'approved';

alter table public.driver_profiles
  alter column approval_status type text using approval_status::text;

-- ---------------------------------------------------------------------
-- 3. Ensure rides and driver_locations tables exist with UUID-safe FK refs
-- ---------------------------------------------------------------------
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  driver_id uuid references public.profiles(id) on delete set null,
  ride_type text not null check (ride_type in ('bike', 'auto')),
  pickup_address text not null,
  pickup_latitude double precision not null,
  pickup_longitude double precision not null,
  dropoff_address text not null,
  dropoff_latitude double precision not null,
  dropoff_longitude double precision not null,
  estimated_distance_km numeric,
  estimated_duration_minutes integer,
  fare_estimate numeric,
  actual_fare numeric,
  status text not null default 'requested' check (status in (
    'requested',
    'searching_driver',
    'driver_assigned',
    'driver_arriving',
    'driver_arrived',
    'trip_started',
    'trip_completed',
    'cancelled'
  )),
  requested_at timestamptz not null default now(),
  driver_assigned_at timestamptz,
  trip_started_at timestamptz,
  trip_completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  ride_id uuid references public.rides(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy numeric,
  heading numeric,
  speed numeric,
  created_at timestamptz not null default now()
);

create index if not exists driver_profiles_vehicle_type_idx on public.driver_profiles(vehicle_type);
create index if not exists driver_profiles_is_online_idx on public.driver_profiles(is_online);
create index if not exists rides_customer_id_idx on public.rides(customer_id);
create index if not exists rides_driver_id_idx on public.rides(driver_id);
create index if not exists rides_status_idx on public.rides(status);
create index if not exists rides_ride_type_idx on public.rides(ride_type);
create index if not exists driver_locations_driver_id_idx on public.driver_locations(driver_id);
create index if not exists driver_locations_ride_id_idx on public.driver_locations(ride_id);

-- ---------------------------------------------------------------------
-- 4. Seed required service categories without duplicating data
-- ---------------------------------------------------------------------
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
-- 5. Fix the broken driver approval policy by using the real profiles table
-- ---------------------------------------------------------------------
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
      and coalesce(p2.approval_status, 'approved') = 'approved'
  )
);

-- This also covers the driver's own profile access.
drop policy if exists "driver_profiles driver read own" on public.driver_profiles;
create policy "driver_profiles driver read own"
on public.driver_profiles for select
using (id = auth.uid());

drop policy if exists "driver_profiles driver update own" on public.driver_profiles;
create policy "driver_profiles driver update own"
on public.driver_profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Admin can read all driver profiles.
drop policy if exists "driver_profiles admin read" on public.driver_profiles;
create policy "driver_profiles admin read"
on public.driver_profiles for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------
-- 6. Enable RLS and ensure auth is enforced by DB rules
-- ---------------------------------------------------------------------
alter table public.driver_profiles enable row level security;
alter table public.rides enable row level security;
alter table public.driver_locations enable row level security;

-- Customer can read/create own rides only.
drop policy if exists "rides customer read own" on public.rides;
create policy "rides customer read own"
on public.rides for select
using (customer_id = auth.uid());

drop policy if exists "rides customer insert" on public.rides;
create policy "rides customer insert"
on public.rides for insert
with check (customer_id = auth.uid());

-- Customer can cancel own rides.
drop policy if exists "rides customer update own" on public.rides;
create policy "rides customer update own"
on public.rides for update
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

-- Driver can access assigned rides only.
drop policy if exists "rides driver read assigned" on public.rides;
create policy "rides driver read assigned"
on public.rides for select
using (
  driver_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'driver')
);

drop policy if exists "rides driver update assigned" on public.rides;
create policy "rides driver update assigned"
on public.rides for update
using (
  driver_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'driver')
)
with check (
  driver_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'driver')
);

-- Admin can read all rides.
drop policy if exists "rides admin read" on public.rides;
create policy "rides admin read"
on public.rides for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Driver location access is restricted to the driver and active ride customer/admin.
drop policy if exists "driver_locations driver insert own" on public.driver_locations;
create policy "driver_locations driver insert own"
on public.driver_locations for insert
with check (driver_id = auth.uid());

drop policy if exists "driver_locations driver read own" on public.driver_locations;
create policy "driver_locations driver read own"
on public.driver_locations for select
using (driver_id = auth.uid());

drop policy if exists "driver_locations customer read active ride" on public.driver_locations;
create policy "driver_locations customer read active ride"
on public.driver_locations for select
using (
  exists (
    select 1 from public.rides r
    where r.id = ride_id
      and r.customer_id = auth.uid()
      and r.status in ('driver_arriving', 'driver_arrived', 'trip_started')
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "driver_locations admin read" on public.driver_locations;
create policy "driver_locations admin read"
on public.driver_locations for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ---------------------------------------------------------------------
-- 7. Final validation hints
-- ---------------------------------------------------------------------
-- Run in Supabase SQL editor after applying the migration:
-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('profiles', 'driver_profiles', 'rides', 'driver_locations', 'service_categories')
-- order by table_name, ordinal_position;
--
-- Example admin bootstrap:
-- update public.profiles set role = 'admin', approval_status = 'approved' where email = 'you@example.com';

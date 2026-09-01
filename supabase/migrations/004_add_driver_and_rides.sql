-- HOMEFIX Driver and Rides Schema Migration
-- Adds driver role, driver profiles, and ride booking functionality
-- Safe to run multiple times

-- =====================================================================
-- Add driver role as allowed value for profiles.role
-- =====================================================================
-- Note: role column should already allow 'customer', 'employee', 'admin'
-- We'll add driver support and ensure it's in the enum

-- =====================================================================
-- driver_profiles table (extended driver info)
-- =====================================================================
create table if not exists public.driver_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('bike', 'auto')), -- bike or auto
  vehicle_model text,
  vehicle_registration_number text unique,
  vehicle_photo_url text,
  vehicle_capacity integer default 1,
  license_number text unique,
  license_expiry_date date,
  documents jsonb default '{}', -- verification docs
  service_area text,
  is_online boolean default false,
  availability_status text default 'offline' check (availability_status in ('available', 'busy', 'offline')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_profiles_vehicle_type_idx on public.driver_profiles(vehicle_type);
create index if not exists driver_profiles_is_online_idx on public.driver_profiles(is_online);
create index if not exists driver_profiles_availability_idx on public.driver_profiles(availability_status);

-- =====================================================================
-- rides table
-- =====================================================================
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  driver_id uuid references public.profiles(id) on delete set null,
  ride_type text not null check (ride_type in ('bike', 'auto')), -- must match driver.vehicle_type
  
  -- Locations
  pickup_address text not null,
  pickup_latitude double precision not null,
  pickup_longitude double precision not null,
  dropoff_address text not null,
  dropoff_latitude double precision not null,
  dropoff_longitude double precision not null,
  
  -- Pricing and details
  estimated_distance_km numeric,
  estimated_duration_minutes integer,
  fare_estimate numeric,
  actual_fare numeric,
  
  -- Status tracking
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
  
  -- Timestamps
  requested_at timestamptz not null default now(),
  driver_assigned_at timestamptz,
  trip_started_at timestamptz,
  trip_completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rides_customer_id_idx on public.rides(customer_id);
create index if not exists rides_driver_id_idx on public.rides(driver_id);
create index if not exists rides_status_idx on public.rides(status);
create index if not exists rides_ride_type_idx on public.rides(ride_type);
create index if not exists rides_requested_at_idx on public.rides(requested_at);

-- =====================================================================
-- driver_locations table
-- =====================================================================
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

create index if not exists driver_locations_driver_id_idx on public.driver_locations(driver_id);
create index if not exists driver_locations_ride_id_idx on public.driver_locations(ride_id);

-- =====================================================================
-- Enable RLS on new tables
-- =====================================================================

alter table public.driver_profiles enable row level security;
alter table public.rides enable row level security;
alter table public.driver_locations enable row level security;

-- =====================================================================
-- RLS Policies for driver_profiles
-- =====================================================================

-- Drivers can read their own profile
create policy "driver_profiles driver read own"
on public.driver_profiles for select
using (id = auth.uid());

-- Customers can read approved drivers (when searching for rides)
create policy "driver_profiles customers read approved"
on public.driver_profiles for select
using (
  exists (select 1 from public.profiles p 
    where p.id = auth.uid() and p.role = 'customer')
  and exists (select 1 from public.profiles p2
    where p2.id = driver_profiles.id and p2.role = 'driver' and coalesce(p2.approval_status, 'approved') = 'approved')
);

-- Admins can read all driver profiles
create policy "driver_profiles admin read"
on public.driver_profiles for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Drivers can update their own profile
create policy "driver_profiles driver update own"
on public.driver_profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- =====================================================================
-- RLS Policies for rides
-- =====================================================================

-- Customers can read and create their own rides
create policy "rides customer read own"
on public.rides for select
using (customer_id = auth.uid());

-- Drivers can read assigned rides
create policy "rides driver read assigned"
on public.rides for select
using (
  driver_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'driver')
);

-- Customers can update their own rides (cancel)
create policy "rides customer update own"
on public.rides for update
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

-- Drivers can update assigned rides (accept, update status)
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

-- Admins can read all rides
create policy "rides admin read"
on public.rides for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Customers can create rides
create policy "rides customer insert"
on public.rides for insert
with check (customer_id = auth.uid());

-- =====================================================================
-- RLS Policies for driver_locations
-- =====================================================================

-- Drivers can insert their own location
create policy "driver_locations driver insert own"
on public.driver_locations for insert
with check (driver_id = auth.uid());

-- Drivers can read their own locations
create policy "driver_locations driver read own"
on public.driver_locations for select
using (driver_id = auth.uid());

-- Customers can read driver location for active rides
create policy "driver_locations customer read active ride"
on public.driver_locations for select
using (
  exists (
    select 1 from public.rides r
    where r.id = ride_id 
    and r.customer_id = auth.uid()
    and r.status in ('driver_arriving', 'driver_arrived', 'trip_started')
  )
);

-- Admins can read all driver locations
create policy "driver_locations admin read"
on public.driver_locations for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- =====================================================================
-- Seed ride-related data (optional)
-- =====================================================================
-- None needed initially - drivers and customers create rides dynamically

-- =====================================================================
-- Verification queries
-- =====================================================================
-- Run these to verify the migration:
-- 
-- SELECT tablename FROM information_schema.tables 
-- WHERE table_schema = 'public' AND tablename IN ('driver_profiles', 'rides', 'driver_locations')
-- ORDER BY tablename;
--
-- To create a driver account after signup:
-- UPDATE public.profiles SET role = 'driver' 
-- WHERE email = 'driver@example.com';
--
-- To approve a driver:
-- UPDATE public.profiles SET approval_status = 'approved' 
-- WHERE email = 'driver@example.com' AND role = 'driver';

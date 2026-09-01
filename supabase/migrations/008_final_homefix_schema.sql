-- HOMEFIX final additive schema repair.
-- Apply this after the earlier migrations. It is idempotent, preserves data,
-- and creates columns/tables before their policies or functions reference them.

create extension if not exists pgcrypto;

-- Core identity fields used by role-aware policies.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  role text not null default 'customer',
  approval_status text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists approval_status text not null default 'approved';
alter table public.profiles add column if not exists profile_photo_url text;
alter table public.profiles add column if not exists average_rating numeric(3,2) not null default 5.00;
alter table public.profiles add column if not exists total_jobs integer not null default 0;
alter table public.profiles add column if not exists is_online boolean not null default false;

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon_url text,
  sort_order integer not null default 0,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_categories add column if not exists description text;
alter table public.service_categories add column if not exists icon_url text;
alter table public.service_categories add column if not exists sort_order integer not null default 0;
alter table public.service_categories add column if not exists display_order integer not null default 0;
alter table public.service_categories add column if not exists active boolean not null default true;
alter table public.service_categories add column if not exists updated_at timestamptz not null default now();

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  service text not null,
  mobile text,
  address text not null,
  booking_date date not null,
  booking_time time not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);

alter table public.bookings add column if not exists professional_id uuid references public.profiles(id);
alter table public.bookings add column if not exists amount numeric;
alter table public.bookings add column if not exists updated_at timestamptz not null default now();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text,
  type text not null default 'general',
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create table if not exists public.driver_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type text not null default 'bike' check (vehicle_type in ('bike', 'auto')),
  vehicle_registration_number text,
  is_online boolean not null default false,
  availability_status text not null default 'offline',
  approval_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_profiles add column if not exists approval_status text not null default 'pending';
alter table public.driver_profiles add column if not exists current_latitude double precision;
alter table public.driver_profiles add column if not exists current_longitude double precision;
alter table public.driver_profiles add column if not exists last_location_at timestamptz;
alter table public.driver_profiles add column if not exists total_rides integer not null default 0;
alter table public.driver_profiles add column if not exists earnings numeric not null default 0;

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
  fare_estimate numeric,
  actual_fare numeric,
  estimated_duration_minutes integer,
  status text not null default 'requested',
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

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  ride_id uuid references public.rides(id) on delete set null,
  amount numeric not null,
  currency text not null default 'INR',
  method text not null,
  status text not null default 'pending',
  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  provider_signature text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Existing versions use customer_id and a required booking_id. Keep all rows
-- while extending the table for server-verified ride payments.
alter table public.payments alter column booking_id drop not null;
alter table public.payments add column if not exists ride_id uuid references public.rides(id) on delete set null;
alter table public.payments add column if not exists provider text not null default 'razorpay';
alter table public.payments add column if not exists provider_order_id text;
alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists provider_signature text;
alter table public.payments add column if not exists completed_at timestamptz;
alter table public.payments add column if not exists updated_at timestamptz not null default now();
create index if not exists payments_ride_id_idx on public.payments(ride_id);
create unique index if not exists payments_provider_order_id_idx on public.payments(provider_order_id) where provider_order_id is not null;

create index if not exists bookings_professional_id_idx on public.bookings(professional_id);
create index if not exists driver_profiles_online_type_idx on public.driver_profiles(is_online, vehicle_type);
create index if not exists rides_driver_status_idx on public.rides(driver_id, status);
create index if not exists driver_locations_ride_created_idx on public.driver_locations(ride_id, created_at desc);

-- SECURITY DEFINER avoids recursive profiles RLS evaluation in policies.
create or replace function public.homefix_has_role(expected_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = expected_role and approval_status = 'approved'
  );
$$;

create or replace function public.homefix_customer_has_booking_with(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.bookings
    where customer_id = auth.uid() and professional_id = profile_id
  );
$$;

-- An applicant may request employee access, but cannot otherwise promote
-- their own role or approve their own account.
create or replace function public.request_employee_access(
  requested_full_name text,
  requested_phone text,
  requested_services text[],
  requested_experience integer,
  requested_service_area text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  update public.profiles
  set full_name = coalesce(nullif(requested_full_name, ''), full_name),
      phone = coalesce(nullif(requested_phone, ''), phone),
      role = 'employee',
      approval_status = 'pending',
      updated_at = now()
  where id = auth.uid() and role in ('customer', 'employee')
  returning * into applicant;

  if applicant.id is null then
    raise exception 'This account cannot request employee access';
  end if;

  insert into public.employee_profiles (id, service_categories, experience_years, service_area, availability_status)
  values (auth.uid(), coalesce(requested_services, '{}'), greatest(coalesce(requested_experience, 0), 0), requested_service_area, 'offline')
  on conflict (id) do update set
    service_categories = excluded.service_categories,
    experience_years = excluded.experience_years,
    service_area = excluded.service_area,
    availability_status = 'offline',
    updated_at = now();

  return applicant;
end;
$$;

create or replace function public.request_driver_access(
  requested_vehicle_type text,
  requested_vehicle_number text
)
returns public.driver_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  driver_record public.driver_profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if requested_vehicle_type not in ('bike', 'auto') or nullif(trim(requested_vehicle_number), '') is null then
    raise exception 'A vehicle type and vehicle number are required';
  end if;

  update public.profiles
  set role = 'driver', approval_status = 'pending', updated_at = now()
  where id = auth.uid() and role in ('customer', 'driver');

  if not found then
    raise exception 'This account cannot request driver access';
  end if;

  insert into public.driver_profiles (id, vehicle_type, vehicle_registration_number, approval_status, is_online, availability_status)
  values (auth.uid(), requested_vehicle_type, trim(requested_vehicle_number), 'pending', false, 'offline')
  on conflict (id) do update set
    vehicle_type = excluded.vehicle_type,
    vehicle_registration_number = excluded.vehicle_registration_number,
    approval_status = 'pending',
    is_online = false,
    availability_status = 'offline',
    updated_at = now()
  returning * into driver_record;

  return driver_record;
end;
$$;

alter table public.rides enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.driver_locations enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;

-- Migration 003's former `with check (true)` policy let any client create a
-- notification for another account. Clients may only create their own;
-- cross-account status notifications are produced by trusted triggers.
drop policy if exists "notifications system insert" on public.notifications;
drop policy if exists "notifications insert own" on public.notifications;
create policy "notifications insert own"
on public.notifications for insert
with check (user_id = auth.uid());

create or replace function public.homefix_notify_booking_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_type text;
  notification_title text;
  notification_message text;
begin
  if new.professional_id is distinct from old.professional_id and new.professional_id is not null then
    notification_type := 'employee_assigned';
    notification_title := 'Professional assigned';
    notification_message := 'A HOMEFIX professional accepted your booking.';
  elsif new.status is distinct from old.status then
    select case new.status
      when 'ON_THE_WAY' then 'employee_arriving'
      when 'SERVICE_STARTED' then 'service_started'
      when 'COMPLETED' then 'service_completed'
      when 'CANCELLED' then 'booking_cancelled'
    end,
    case new.status
      when 'ON_THE_WAY' then 'Professional on the way'
      when 'SERVICE_STARTED' then 'Service started'
      when 'COMPLETED' then 'Service completed'
      when 'CANCELLED' then 'Booking cancelled'
    end,
    case new.status
      when 'ON_THE_WAY' then 'Your professional is on the way.'
      when 'SERVICE_STARTED' then 'Your service has started.'
      when 'COMPLETED' then 'Your service is complete.'
      when 'CANCELLED' then 'Your booking was cancelled.'
    end into notification_type, notification_title, notification_message;
  end if;

  if notification_type is not null then
    insert into public.notifications (user_id, type, title, message, booking_id)
    values (new.customer_id, notification_type, notification_title, notification_message, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists homefix_booking_transition_notification on public.bookings;
create trigger homefix_booking_transition_notification
after update on public.bookings
for each row execute function public.homefix_notify_booking_transition();

create or replace function public.homefix_notify_ride_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_type text;
  notification_title text;
  notification_message text;
begin
  select case new.status
    when 'driver_assigned' then 'ride_accepted'
    when 'driver_arriving' then 'driver_arriving'
    when 'trip_started' then 'ride_started'
    when 'trip_completed' then 'ride_completed'
    when 'cancelled' then 'ride_cancelled'
  end,
  case new.status
    when 'driver_assigned' then 'Driver assigned'
    when 'driver_arriving' then 'Driver is arriving'
    when 'trip_started' then 'Ride started'
    when 'trip_completed' then 'Ride completed'
    when 'cancelled' then 'Ride cancelled'
  end,
  case new.status
    when 'driver_assigned' then 'A driver accepted your ride request.'
    when 'driver_arriving' then 'Your driver is on the way to pickup.'
    when 'trip_started' then 'Your ride has started.'
    when 'trip_completed' then 'Your ride is complete.'
    when 'cancelled' then 'Your ride was cancelled.'
  end into notification_type, notification_title, notification_message;

  if new.status is distinct from old.status and notification_type is not null then
    insert into public.notifications (user_id, type, title, message)
    values (new.customer_id, notification_type, notification_title, notification_message);
  end if;
  return new;
end;
$$;

drop trigger if exists homefix_ride_transition_notification on public.rides;
create trigger homefix_ride_transition_notification
after update on public.rides
for each row execute function public.homefix_notify_ride_transition();

-- Customers may read the limited public profile fields of the professional
-- assigned to one of their own bookings, enabling real assignment tracking.
drop policy if exists "profiles customer read assigned professional" on public.profiles;
create policy "profiles customer read assigned professional"
on public.profiles for select
using (
  public.homefix_customer_has_booking_with(id)
);

-- Only approved online drivers can inspect compatible searching rides.
drop policy if exists "rides driver read searching" on public.rides;
create policy "rides driver read searching"
on public.rides for select
using (
  status = 'searching_driver'
  and driver_id is null
  and public.homefix_has_role('driver')
  and exists (
    select 1 from public.driver_profiles d
    where d.id = auth.uid()
      and d.is_online = true
      and d.approval_status = 'approved'
      and d.vehicle_type = rides.ride_type
  )
);

-- The existing assigned-ride policy handles later transitions; this policy
-- permits the initial guarded claim only while the ride remains unassigned.
drop policy if exists "rides driver claim searching" on public.rides;
create policy "rides driver claim searching"
on public.rides for update
using (
  status = 'searching_driver'
  and driver_id is null
  and public.homefix_has_role('driver')
)
with check (
  driver_id = auth.uid()
  and status = 'driver_assigned'
  and public.homefix_has_role('driver')
  and exists (
    select 1 from public.driver_profiles d
    where d.id = auth.uid()
      and d.is_online = true
      and d.approval_status = 'approved'
      and d.vehicle_type = rides.ride_type
  )
);

drop policy if exists "driver_locations driver update own" on public.driver_locations;
create policy "driver_locations driver update own"
on public.driver_locations for update
using (driver_id = auth.uid() and public.homefix_has_role('driver'))
with check (driver_id = auth.uid() and public.homefix_has_role('driver'));

-- Employees can see and atomically claim open work, then only see their own jobs.
drop policy if exists "bookings approved employee read open" on public.bookings;
create policy "bookings approved employee read open"
on public.bookings for select
using (
  status = 'PENDING'
  and professional_id is null
  and public.homefix_has_role('employee')
);

drop policy if exists "bookings approved employee claim" on public.bookings;
create policy "bookings approved employee claim"
on public.bookings for update
using (
  status = 'PENDING'
  and professional_id is null
  and public.homefix_has_role('employee')
)
with check (
  professional_id = auth.uid()
  and status = 'ASSIGNED'
  and public.homefix_has_role('employee')
);

-- Realtime subscriptions used by customer booking/ride tracking.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings') then
    alter publication supabase_realtime add table public.bookings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rides') then
    alter publication supabase_realtime add table public.rides;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_locations') then
    alter publication supabase_realtime add table public.driver_locations;
  end if;
end $$;

insert into public.service_categories (name, description, display_order, active)
values
  ('Bike Mechanic', 'Bike repair and roadside assistance', 9, true),
  ('Car Mechanic', 'Car repair and roadside assistance', 10, true),
  ('Plumber', 'Plumbing and sanitary repairs', 1, true),
  ('Electrician', 'Electrical wiring and repairs', 2, true),
  ('Carpenter', 'Carpentry and furniture work', 5, true),
  ('Painter', 'Painting and wall finishing', 6, true),
  ('Pest Control', 'Pest and termite control', 7, true)
on conflict (name) do nothing;
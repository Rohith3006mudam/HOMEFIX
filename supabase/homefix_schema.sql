-- HOMEFIX consolidated schema & repair migration.
-- Safe to run multiple times. Does not drop public.bookings and does not
-- delete existing rows. Run this file in the Supabase SQL Editor.
--
-- Background: public.bookings already exists in production with columns
-- (id, customer_id, service, mobile, address, booking_date, booking_time,
-- status, created_at). A previous migration attempt (fix_bookings_rls.sql)
-- cast auth.uid()::text against customer_id, which only makes sense if
-- customer_id is TEXT rather than UUID. This script inspects the actual
-- column type first and converts it safely, in place, without touching data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. profiles: one row per Supabase Auth user, used for role + display info
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  role text not null default 'customer' check (role in ('customer', 'professional', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self insert" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;

create policy "profiles self read"
on public.profiles for select
using (id = auth.uid());

create policy "profiles self insert"
on public.profiles for insert
with check (id = auth.uid() and role = 'customer');

-- Customers may update their own name/phone but never their own role.
create policy "profiles self update"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Auto-create a profile row whenever a new Supabase Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    new.email,
    'customer'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    phone = coalesce(nullif(excluded.phone, ''), public.profiles.phone),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. bookings: repair customer_id type in place, keep every other column
-- ---------------------------------------------------------------------

-- Only convert if customer_id is not already uuid. Existing UUID-looking
-- text values are preserved; anything blank/invalid becomes NULL rather
-- than failing the whole migration.
do $$
declare
  current_type text;
begin
  select data_type into current_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'bookings' and column_name = 'customer_id';

  if current_type is not null and current_type <> 'uuid' then
    alter table public.bookings
      alter column customer_id type uuid
      using nullif(customer_id, '')::uuid;
  end if;
end $$;

-- Additive columns only (never destructive) to support professional
-- assignment and live tracking, matching the existing app UI.
alter table public.bookings add column if not exists professional_id uuid references public.profiles(id);
alter table public.bookings add column if not exists amount numeric;
alter table public.bookings add column if not exists updated_at timestamptz not null default now();

create index if not exists bookings_customer_id_idx on public.bookings(customer_id);
create index if not exists bookings_professional_id_idx on public.bookings(professional_id);
create index if not exists bookings_status_idx on public.bookings(status);

alter table public.bookings enable row level security;

drop policy if exists "homefix customer bookings select" on public.bookings;
drop policy if exists "homefix customer bookings insert" on public.bookings;
drop policy if exists "homefix customer booking cancellation" on public.bookings;
drop policy if exists "homefix authenticated bookings select" on public.bookings;
drop policy if exists "homefix authenticated bookings insert" on public.bookings;
drop policy if exists "homefix authenticated bookings cancel" on public.bookings;
drop policy if exists "bookings customer read" on public.bookings;
drop policy if exists "bookings customer create" on public.bookings;
drop policy if exists "bookings assigned update" on public.bookings;
drop policy if exists "Allow public booking submissions" on public.bookings;
drop policy if exists "Allow public booking reads" on public.bookings;

-- Customers can read their own bookings; assigned professionals and admins
-- can read the bookings relevant to them.
create policy "bookings select own or assigned"
on public.bookings for select
using (
  customer_id = auth.uid()
  or professional_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Customers can only create a booking for themselves (never on behalf of
-- someone else, and never with a NULL/anonymous customer_id).
create policy "bookings insert own"
on public.bookings for insert
with check (customer_id = auth.uid());

-- Customers can cancel their own PENDING/CONFIRMED bookings. Assigned
-- professionals and admins can update status on bookings they own/manage.
create policy "bookings update own or assigned"
on public.bookings for update
using (
  (customer_id = auth.uid() and status in ('PENDING', 'CONFIRMED'))
  or professional_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  customer_id = auth.uid()
  or professional_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ---------------------------------------------------------------------
-- 3. tracking_locations: live location pings tied to a booking
-- ---------------------------------------------------------------------
create table if not exists public.tracking_locations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists tracking_booking_id_idx on public.tracking_locations(booking_id);

alter table public.tracking_locations enable row level security;

drop policy if exists "tracking select for booking owner" on public.tracking_locations;
drop policy if exists "tracking insert by assigned professional" on public.tracking_locations;

create policy "tracking select for booking owner"
on public.tracking_locations for select
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.customer_id = auth.uid() or b.professional_id = auth.uid())
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "tracking insert by assigned professional"
on public.tracking_locations for insert
with check (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.professional_id = auth.uid()
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ---------------------------------------------------------------------
-- Verification queries (run manually after applying the migration)
-- ---------------------------------------------------------------------
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'bookings' order by ordinal_position;
--
-- select * from public.bookings order by created_at desc limit 10;
--
-- Bootstrap the first admin account (after that user has signed up once):
-- update public.profiles set role = 'admin' where email = 'your-admin-email@example.com';

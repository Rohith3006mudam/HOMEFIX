-- HOMEFIX platform expansion migration.
-- Additive only: never drops/alters existing production data in
-- public.profiles or public.bookings (see supabase/homefix_schema.sql,
-- which must be applied first). Safe to re-run.
--
-- Role model note: production already uses profiles.role in
-- ('customer', 'professional', 'admin'). This migration keeps
-- "professional" (not "employee") to match the live schema and avoid
-- breaking already-registered users.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Helper functions (security definer, no recursive RLS)
-- ---------------------------------------------------------------------
create or replace function public.get_my_profile()
returns public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_professional()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'professional');
$$;

create or replace function public.is_customer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'customer');
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- service_categories / services (replace hardcoded SERVICES array)
-- ---------------------------------------------------------------------
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  description text,
  image text,
  base_price numeric not null default 0,
  duration_minutes int not null default 60,
  rating numeric not null default 4.8,
  review_count int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();

alter table public.service_categories enable row level security;
alter table public.services enable row level security;

drop policy if exists "categories public read" on public.service_categories;
create policy "categories public read" on public.service_categories for select using (true);
drop policy if exists "categories admin write" on public.service_categories;
create policy "categories admin write" on public.service_categories for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "services public read" on public.services;
create policy "services public read" on public.services for select using (active or public.is_admin());
drop policy if exists "services admin write" on public.services;
create policy "services admin write" on public.services for all
using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- customer_addresses
-- ---------------------------------------------------------------------
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  full_name text,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text,
  postal_code text not null,
  latitude double precision,
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_user_id_idx on public.customer_addresses(user_id);

alter table public.customer_addresses enable row level security;
drop policy if exists "addresses owner all" on public.customer_addresses;
create policy "addresses owner all" on public.customer_addresses for all
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- employees (professional profile) / employee_services
-- ---------------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  employee_code text unique,
  full_name text,
  phone text,
  profile_photo text,
  bio text,
  experience_years int not null default 0,
  rating numeric not null default 5,
  total_jobs int not null default 0,
  service_radius_km numeric not null default 10,
  is_verified boolean not null default false,
  is_online boolean not null default false,
  current_latitude double precision,
  current_longitude double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_services (
  employee_id uuid not null references public.employees(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (employee_id, service_id)
);

alter table public.employees enable row level security;
alter table public.employee_services enable row level security;

drop policy if exists "employees self read write" on public.employees;
create policy "employees self read write" on public.employees for all
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "employees public read verified" on public.employees;
create policy "employees public read verified" on public.employees for select
using (is_verified = true or user_id = auth.uid() or public.is_admin());

drop policy if exists "employee_services read" on public.employee_services;
create policy "employee_services read" on public.employee_services for select using (true);
drop policy if exists "employee_services owner write" on public.employee_services;
create policy "employee_services owner write" on public.employee_services for all
using (
  exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
  or public.is_admin()
)
with check (
  exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
  or public.is_admin()
);

-- ---------------------------------------------------------------------
-- booking_assignments + employee_locations (auto-assign + live tracking)
-- ---------------------------------------------------------------------
create table if not exists public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  distance_km numeric,
  assignment_status text not null default 'offered'
    check (assignment_status in ('offered', 'accepted', 'rejected', 'expired')),
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists booking_assignments_booking_idx on public.booking_assignments(booking_id);
create index if not exists booking_assignments_employee_idx on public.booking_assignments(employee_id);

create table if not exists public.employee_locations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  is_online boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists employee_locations_employee_idx on public.employee_locations(employee_id);
create index if not exists employee_locations_booking_idx on public.employee_locations(booking_id);

alter table public.booking_assignments enable row level security;
alter table public.employee_locations enable row level security;

drop policy if exists "assignments visible to parties" on public.booking_assignments;
create policy "assignments visible to parties" on public.booking_assignments for select
using (
  exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
  or exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
  or public.is_admin()
);
drop policy if exists "assignments employee responds" on public.booking_assignments;
create policy "assignments employee responds" on public.booking_assignments for update
using (exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()) or public.is_admin())
with check (exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()) or public.is_admin());
drop policy if exists "assignments system insert" on public.booking_assignments;
create policy "assignments system insert" on public.booking_assignments for insert
with check (
  exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "employee_locations read for active booking" on public.employee_locations;
create policy "employee_locations read for active booking" on public.employee_locations for select
using (
  exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
  or exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = auth.uid()
      and b.status not in ('COMPLETED', 'CANCELLED')
  )
  or public.is_admin()
);
drop policy if exists "employee_locations write own" on public.employee_locations;
create policy "employee_locations write own" on public.employee_locations for insert
with check (exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()));
drop policy if exists "employee_locations update own" on public.employee_locations;
create policy "employee_locations update own" on public.employee_locations for update
using (exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()))
with check (exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- reviews / notifications / support_tickets / admin_audit_logs
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews for select using (true);
drop policy if exists "reviews owner insert" on public.reviews;
create policy "reviews owner insert" on public.reviews for insert
with check (
  customer_id = auth.uid()
  and exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid() and b.status = 'COMPLETED')
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text,
  type text not null default 'general',
  booking_id uuid references public.bookings(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id);

alter table public.notifications enable row level security;
drop policy if exists "notifications owner read" on public.notifications;
create policy "notifications owner read" on public.notifications for select
using (user_id = auth.uid() or public.is_admin());
drop policy if exists "notifications owner update" on public.notifications;
create policy "notifications owner update" on public.notifications for update
using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  category text not null default 'other',
  subject text,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at before update on public.support_tickets
for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;
drop policy if exists "support owner all" on public.support_tickets;
create policy "support owner all" on public.support_tickets for all
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;
drop policy if exists "audit admin only" on public.admin_audit_logs;
create policy "audit admin only" on public.admin_audit_logs for all
using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Realtime publication for live-tracking + notifications
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employee_locations'
  ) then
    alter publication supabase_realtime add table public.employee_locations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Seed starter services (idempotent; read by the frontend instead of
-- the hardcoded SERVICES array once the app is wired to this table)
-- ---------------------------------------------------------------------
insert into public.service_categories (name, sort_order)
values
  ('Electrician', 1), ('Plumbing', 2), ('AC Repair', 3), ('AC Service', 4),
  ('Home Cleaning', 5), ('Bathroom Cleaning', 6), ('Kitchen Cleaning', 7),
  ('Carpentry', 8), ('Painting', 9), ('Appliance Repair', 10),
  ('RO Service', 11), ('Pest Control', 12)
on conflict (name) do nothing;

insert into public.services (category_id, name, description, base_price, duration_minutes)
select c.id, v.name, v.description, v.base_price, v.duration_minutes
from (values
  ('Electrician', 'Electrical Repair', 'Switches, wiring, fans and safe repairs', 249, 60),
  ('Plumbing', 'Plumbing Repair', 'Leaks, taps, pipes and bathroom repairs', 199, 60),
  ('AC Repair', 'AC Repair', 'Cooling service, gas refill and repair', 349, 90),
  ('AC Service', 'AC General Service', 'Routine cleaning and maintenance', 299, 60),
  ('Home Cleaning', 'Deep Home Cleaning', 'Deep cleaning for a fresher home', 399, 120),
  ('Bathroom Cleaning', 'Bathroom Deep Cleaning', 'Hygienic bathroom deep cleaning', 299, 60),
  ('Kitchen Cleaning', 'Kitchen Deep Cleaning', 'Degreasing and sanitizing', 349, 90),
  ('Carpentry', 'Carpentry Service', 'Furniture assembly and woodwork', 299, 90),
  ('Painting', 'Painting Service', 'Beautiful finishes for every room', 599, 240),
  ('Appliance Repair', 'Appliance Repair', 'Reliable repairs for everyday appliances', 299, 60),
  ('RO Service', 'Water Purifier Service', 'Filter replacement and servicing', 249, 45),
  ('Pest Control', 'Pest Control', 'Targeted protection for your home', 499, 90)
) as v(category_name, name, description, base_price, duration_minutes)
join public.service_categories c on c.name = v.category_name
where not exists (select 1 from public.services s where s.name = v.name);

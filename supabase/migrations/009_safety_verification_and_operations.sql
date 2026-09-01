-- HOMEFIX safety, verification, and operations foundation.
-- Additive only: no customer data is deleted and no identity document values
-- are stored here. External KYC providers own sensitive document handling.

alter table public.profiles add column if not exists verification_status text not null default 'pending';
alter table public.profiles add column if not exists verification_provider text;
alter table public.profiles add column if not exists verification_reference text;
alter table public.profiles add column if not exists verified_at timestamptz;

alter table public.profiles drop constraint if exists profiles_verification_status_check;
alter table public.profiles add constraint profiles_verification_status_check
  check (verification_status in ('pending', 'submitted', 'under_review', 'verified', 'rejected', 'expired')) not valid;
alter table public.profiles validate constraint profiles_verification_status_check;
create index if not exists profiles_verification_status_idx on public.profiles(verification_status);

create table if not exists public.verification_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_role text not null check (subject_role in ('employee', 'driver')),
  status text not null default 'pending' check (status in ('pending', 'submitted', 'under_review', 'verified', 'rejected', 'expired')),
  provider text,
  provider_reference text,
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verification_cases_user_status_idx on public.verification_cases(user_id, status);
alter table public.verification_cases enable row level security;

drop policy if exists "verification cases self read" on public.verification_cases;
create policy "verification cases self read" on public.verification_cases for select
using (user_id = auth.uid() or public.homefix_has_role('admin'));

drop policy if exists "verification cases self submit" on public.verification_cases;
create policy "verification cases self submit" on public.verification_cases for insert
with check (
  user_id = auth.uid()
  and subject_role in ('employee', 'driver')
  and status in ('pending', 'submitted')
);

drop policy if exists "verification cases admin manage" on public.verification_cases;
create policy "verification cases admin manage" on public.verification_cases for update
using (public.homefix_has_role('admin'))
with check (public.homefix_has_role('admin'));

create table if not exists public.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  ride_id uuid references public.rides(id) on delete set null,
  category text not null check (category in ('emergency', 'unsafe_situation', 'harassment', 'accident', 'other')),
  details text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'investigating', 'resolved', 'closed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists safety_incidents_reporter_idx on public.safety_incidents(reporter_id, created_at desc);
create index if not exists safety_incidents_status_idx on public.safety_incidents(status, created_at desc);
alter table public.safety_incidents enable row level security;

drop policy if exists "safety incidents reporter read" on public.safety_incidents;
create policy "safety incidents reporter read" on public.safety_incidents for select
using (reporter_id = auth.uid() or public.homefix_has_role('admin'));

drop policy if exists "safety incidents reporter insert" on public.safety_incidents;
create policy "safety incidents reporter insert" on public.safety_incidents for insert
with check (reporter_id = auth.uid());

drop policy if exists "safety incidents admin update" on public.safety_incidents;
create policy "safety incidents admin update" on public.safety_incidents for update
using (public.homefix_has_role('admin'))
with check (public.homefix_has_role('admin'));

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;
drop policy if exists "audit logs admin read" on public.admin_audit_logs;
create policy "audit logs admin read" on public.admin_audit_logs for select
using (public.homefix_has_role('admin'));

-- Customer, employee, driver, and admin may report an incident. Only the
-- reporter and authorized administrators can ever read it.
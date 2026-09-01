-- HOMEFIX platform settings table (admin Settings screen).
-- Additive only; safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings admin all" on public.platform_settings;
create policy "platform_settings admin all"
on public.platform_settings for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Public (any authenticated user) may read a small allow-listed set of
-- settings the customer app needs, e.g. cancellation window.
drop policy if exists "platform_settings public read" on public.platform_settings;
create policy "platform_settings public read"
on public.platform_settings for select
using (key in ('cancellation_window_hours', 'business_hours_start', 'business_hours_end', 'service_fee_percent'));

insert into public.platform_settings (key, value)
values
  ('business_hours_start', '"07:00"'),
  ('business_hours_end', '"21:00"'),
  ('cancellation_window_hours', '2'),
  ('service_fee_percent', '5')
on conflict (key) do nothing;

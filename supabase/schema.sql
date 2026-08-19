create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role text not null default 'customer' check (role in ('customer','employee','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), profile_id uuid unique references public.profiles(id) on delete cascade,
  phone text, email text, created_at timestamptz not null default now()
);
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(), profile_id uuid unique references public.profiles(id) on delete cascade,
  employee_code text unique not null, service_category text, experience_years integer default 0,
  rating numeric(3,2) default 0, verification_status text default 'pending', availability_status text default 'offline',
  created_at timestamptz not null default now()
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), name text not null, category text, description text,
  starting_price numeric not null default 0, duration_minutes integer default 60, image_url text, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
  label text, house_number text, street text, area text, city text, state text, pincode text, landmark text,
  latitude numeric, longitude numeric, created_at timestamptz not null default now()
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(), booking_number text unique not null,
  customer_id uuid not null references public.customers(id), employee_id uuid references public.employees(id), service_id uuid references public.services(id), address_id uuid references public.addresses(id),
  scheduled_date date not null, scheduled_time text not null, amount numeric not null default 0, payment_method text,
  payment_status text not null default 'PENDING' check (payment_status in ('PENDING','PAID','FAILED','REFUNDED','CASH')),
  booking_status text not null default 'PENDING' check (booking_status in ('PENDING','CONFIRMED','ASSIGNED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED')),
  tracking_status text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid references public.customers(id), amount numeric not null default 0, payment_method text,
  payment_status text not null default 'PENDING' check (payment_status in ('PENDING','PAID','FAILED','REFUNDED','CASH')),
  transaction_reference text, created_at timestamptz not null default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), booking_id uuid unique references public.bookings(id) on delete cascade,
  customer_id uuid references public.customers(id), employee_id uuid references public.employees(id), rating integer not null check (rating between 1 and 5), comment text, created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, message text not null, type text, read boolean not null default false, created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.employees enable row level security;
alter table public.services enable row level security;
alter table public.addresses enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin'); $$;
create or replace function public.is_employee() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'employee'); $$;

create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles self update" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "profiles admin insert" on public.profiles for insert with check (id = auth.uid() or public.is_admin());
create policy "customers own read" on public.customers for select using (profile_id = auth.uid() or public.is_admin());
create policy "customers own write" on public.customers for all using (profile_id = auth.uid() or public.is_admin()) with check (profile_id = auth.uid() or public.is_admin());
create policy "employees own read" on public.employees for select using (profile_id = auth.uid() or public.is_admin());
create policy "employees own update" on public.employees for update using (profile_id = auth.uid() or public.is_admin()) with check (profile_id = auth.uid() or public.is_admin());
create policy "services public read" on public.services for select using (active = true or public.is_admin());
create policy "services admin write" on public.services for all using (public.is_admin()) with check (public.is_admin());
create policy "addresses own access" on public.addresses for all using (exists (select 1 from customers c where c.id = customer_id and c.profile_id = auth.uid()) or public.is_admin()) with check (exists (select 1 from customers c where c.id = customer_id and c.profile_id = auth.uid()) or public.is_admin());
create policy "bookings customer read" on public.bookings for select using (exists (select 1 from customers c where c.id = customer_id and c.profile_id = auth.uid()) or exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid()) or public.is_admin());
create policy "bookings customer create" on public.bookings for insert with check (exists (select 1 from customers c where c.id = customer_id and c.profile_id = auth.uid()) or public.is_admin());
create policy "bookings assigned update" on public.bookings for update using (exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid()) or public.is_admin()) with check (exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid()) or public.is_admin());
create policy "payments owner read" on public.payments for select using (exists (select 1 from customers c where c.id = customer_id and c.profile_id = auth.uid()) or public.is_admin());
create policy "payments owner create" on public.payments for insert with check (exists (select 1 from customers c where c.id = customer_id and c.profile_id = auth.uid()) or public.is_admin());
create policy "reviews completed owner" on public.reviews for insert with check (exists (select 1 from bookings b join customers c on c.id = b.customer_id where b.id = booking_id and c.profile_id = auth.uid() and b.booking_status = 'COMPLETED') or public.is_admin());
create policy "reviews visible" on public.reviews for select using (true);
create policy "notifications owner" on public.notifications for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, full_name, email, phone, role) values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'phone', coalesce(new.raw_user_meta_data->>'role','customer')); if coalesce(new.raw_user_meta_data->>'role','customer') = 'customer' then insert into public.customers (profile_id, phone, email) values (new.id, new.raw_user_meta_data->>'phone', new.email); end if; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Bootstrap: create the first user through Supabase Auth, then run:
-- update public.profiles set role = 'admin' where email = 'your-admin-email@example.com';

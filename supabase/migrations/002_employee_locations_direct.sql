-- Simplifies employee_locations to reference profiles(id) directly instead
-- of employees(id), matching the profiles-first role model used by the
-- rest of the app (professionals authenticate via profiles, and a
-- dedicated employees row is not required just to share a live location).
-- Safe to re-run; only adjusts the FK + policies, never touches booking data.

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'employee_locations'
      and constraint_name = 'employee_locations_employee_id_fkey'
  ) then
    alter table public.employee_locations drop constraint employee_locations_employee_id_fkey;
  end if;
end $$;

alter table public.employee_locations
  add constraint employee_locations_employee_id_fkey
  foreign key (employee_id) references public.profiles(id) on delete cascade;

drop policy if exists "employee_locations read for active booking" on public.employee_locations;
drop policy if exists "employee_locations write own" on public.employee_locations;
drop policy if exists "employee_locations update own" on public.employee_locations;

create policy "employee_locations read for active booking"
on public.employee_locations for select
using (
  employee_id = auth.uid()
  or exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = auth.uid()
      and b.status not in ('COMPLETED', 'CANCELLED')
  )
  or public.is_admin()
);

create policy "employee_locations write own"
on public.employee_locations for insert
with check (employee_id = auth.uid());

create policy "employee_locations update own"
on public.employee_locations for update
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

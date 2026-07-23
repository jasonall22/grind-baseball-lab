create table if not exists public.booking_staff_availability (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.booking_staff_members(id) on delete cascade,
  availability_date date not null,
  start_time time not null,
  end_time time not null,
  resource_names text[] not null default '{}'::text[],
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists booking_staff_availability_staff_date_idx
on public.booking_staff_availability (staff_member_id, availability_date);

drop trigger if exists touch_booking_staff_availability on public.booking_staff_availability;
create trigger touch_booking_staff_availability
before update on public.booking_staff_availability
for each row execute function public.touch_updated_at();

alter table public.booking_staff_availability enable row level security;

drop policy if exists "Staff can read own booking staff member" on public.booking_staff_members;
create policy "Staff can read own booking staff member"
on public.booking_staff_members
for select
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Admins can manage booking staff availability" on public.booking_staff_availability;
create policy "Admins can manage booking staff availability"
on public.booking_staff_availability
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Staff can manage own booking staff availability" on public.booking_staff_availability;
create policy "Staff can manage own booking staff availability"
on public.booking_staff_availability
for all
using (
  exists (
    select 1
    from public.booking_staff_members staff
    where staff.id = booking_staff_availability.staff_member_id
      and staff.is_active
      and lower(staff.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  exists (
    select 1
    from public.booking_staff_members staff
    where staff.id = booking_staff_availability.staff_member_id
      and staff.is_active
      and lower(staff.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

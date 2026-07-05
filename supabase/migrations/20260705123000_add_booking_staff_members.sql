create table if not exists public.booking_staff_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  role text not null default 'Staff' check (role in ('Owner', 'Admin', 'Instructor', 'Staff')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_booking_staff_members on public.booking_staff_members;
create trigger touch_booking_staff_members
before update on public.booking_staff_members
for each row execute function public.touch_updated_at();

alter table public.booking_staff_members enable row level security;

drop policy if exists "Admins can manage booking staff members" on public.booking_staff_members;
create policy "Admins can manage booking staff members"
on public.booking_staff_members
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.booking_staff_members (full_name, email, role, is_active, sort_order)
select *
from (
  values
    ('August Backman', 'august.baseball19@gmail.com', 'Instructor', true, 1),
    ('Carter Cox', 'cartercox3308@gmail.com', 'Staff', true, 2),
    ('Zachary Allaire', 'zacharyall22@icloud.com', 'Staff', true, 3),
    ('Jr. Jason Allaire', 'jasonall22jr@icloud.com', 'Staff', true, 4),
    ('Brian Cox', 'briancox4677@gmail.com', 'Staff', true, 5),
    ('Andrea Allaire', 'andie0218@hotmail.com', 'Admin', true, 6),
    ('Jason Allaire', 'info@grindbaseballlab.com', 'Owner', true, 7)
) as seed(full_name, email, role, is_active, sort_order)
where not exists (
  select 1
  from public.booking_staff_members
);

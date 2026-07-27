alter table public.booking_customers
add column if not exists auth_user_id uuid;

update public.booking_customers customer
set auth_user_id = auth_user.id
from auth.users auth_user
where customer.auth_user_id is null
  and customer.email is not null
  and lower(customer.email) = lower(auth_user.email);

create unique index if not exists booking_customers_auth_user_id_key
on public.booking_customers (auth_user_id)
where auth_user_id is not null;

alter table public.booking_staff_members
add column if not exists customer_id uuid references public.booking_customers(id) on delete set null,
add column if not exists auth_user_id uuid;

update public.booking_staff_members staff
set customer_id = customer.id,
    auth_user_id = coalesce(customer.auth_user_id, staff.auth_user_id)
from public.booking_customers customer
where staff.customer_id is null
  and staff.email is not null
  and customer.email is not null
  and lower(staff.email) = lower(customer.email);

update public.booking_staff_members staff
set auth_user_id = auth_user.id
from auth.users auth_user
where staff.auth_user_id is null
  and staff.email is not null
  and lower(staff.email) = lower(auth_user.email);

create index if not exists booking_staff_members_customer_id_idx
on public.booking_staff_members (customer_id);

create index if not exists booking_staff_members_auth_user_id_idx
on public.booking_staff_members (auth_user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'owner', 'staff', 'instructor')
  )
  or exists (
    select 1
    from public.booking_staff_members staff
    where staff.is_active
      and (
        staff.auth_user_id = auth.uid()
        or lower(staff.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

drop policy if exists "Staff can read own booking staff member" on public.booking_staff_members;
create policy "Staff can read own booking staff member"
on public.booking_staff_members
for select
using (
  auth_user_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

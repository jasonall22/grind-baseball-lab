alter table public.booking_bookings
add column if not exists staff_member_id uuid references public.booking_staff_members(id) on delete set null;

create index if not exists booking_bookings_staff_date_idx
on public.booking_bookings (staff_member_id, booking_date)
where staff_member_id is not null;

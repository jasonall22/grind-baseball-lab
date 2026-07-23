alter table public.booking_staff_availability
add column if not exists is_recurring boolean not null default false,
add column if not exists recurrence_id text,
add column if not exists recurrence_frequency text,
add column if not exists recurrence_end_date date;

create index if not exists booking_staff_availability_recurrence_idx
on public.booking_staff_availability (recurrence_id)
where recurrence_id is not null;

alter table public.booking_staff_members
add column if not exists phone text,
add column if not exists bio text,
add column if not exists notes text;

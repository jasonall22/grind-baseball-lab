alter table public.booking_customers
add column if not exists birth_year integer check (birth_year is null or birth_year >= 1900),
add column if not exists birth_month integer check (birth_month is null or birth_month between 1 and 12),
add column if not exists birth_day integer check (birth_day is null or birth_day between 1 and 31),
add column if not exists gender text;

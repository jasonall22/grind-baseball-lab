alter table public.booking_customers
add column if not exists age integer check (age is null or age >= 0),
add column if not exists memberships text[] not null default '{}';

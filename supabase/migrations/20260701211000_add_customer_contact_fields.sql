alter table public.booking_customers
add column if not exists address text,
add column if not exists phone_country text not null default 'US';

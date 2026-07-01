alter table public.booking_customers
add column if not exists waiver_agreed boolean not null default false,
add column if not exists emergency_contact_name text,
add column if not exists emergency_contact_phone text;

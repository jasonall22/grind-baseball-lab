alter table public.booking_customers
add column if not exists emergency_contact_email text;

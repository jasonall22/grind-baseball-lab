alter table public.booking_customers
add column if not exists family_members jsonb not null default '[]'::jsonb;

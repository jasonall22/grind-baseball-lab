-- Booking admin tables for The Grind Baseball Lab.
-- Run this in Supabase SQL Editor after confirming your admin users have profiles.role = 'admin'.

create extension if not exists pgcrypto;

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
      and role = 'admin'
  );
$$;

create table if not exists public.booking_settings (
  key text primary key default 'default',
  facility_name text not null default 'The Grind Baseball Lab',
  public_url text not null default 'https://www.grindbaseballlab.com/book',
  timezone text not null default 'America/New_York',
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  price numeric(10, 2) not null default 0 check (price >= 0),
  resource_id uuid references public.booking_resources(id) on delete set null,
  status text not null default 'Active' check (status in ('Active', 'Draft', 'Off')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_customers (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  player_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  customer_id uuid references public.booking_customers(id) on delete set null,
  service_id uuid references public.booking_services(id) on delete set null,
  resource_id uuid references public.booking_resources(id) on delete set null,
  status text not null default 'Confirmed' check (status in ('Confirmed', 'Pending', 'Cancelled')),
  paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.booking_availability (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null unique check (weekday between 0 and 6),
  day_name text not null,
  is_open boolean not null default true,
  start_time time not null default '09:00',
  end_time time not null default '20:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.booking_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audience text not null default 'All customers',
  status text not null default 'Draft' check (status in ('Draft', 'Active', 'Off')),
  sent integer not null default 0 check (sent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_booking_settings on public.booking_settings;
create trigger touch_booking_settings
before update on public.booking_settings
for each row execute function public.touch_updated_at();

drop trigger if exists touch_booking_resources on public.booking_resources;
create trigger touch_booking_resources
before update on public.booking_resources
for each row execute function public.touch_updated_at();

drop trigger if exists touch_booking_services on public.booking_services;
create trigger touch_booking_services
before update on public.booking_services
for each row execute function public.touch_updated_at();

drop trigger if exists touch_booking_customers on public.booking_customers;
create trigger touch_booking_customers
before update on public.booking_customers
for each row execute function public.touch_updated_at();

drop trigger if exists touch_booking_bookings on public.booking_bookings;
create trigger touch_booking_bookings
before update on public.booking_bookings
for each row execute function public.touch_updated_at();

drop trigger if exists touch_booking_availability on public.booking_availability;
create trigger touch_booking_availability
before update on public.booking_availability
for each row execute function public.touch_updated_at();

drop trigger if exists touch_booking_campaigns on public.booking_campaigns;
create trigger touch_booking_campaigns
before update on public.booking_campaigns
for each row execute function public.touch_updated_at();

drop trigger if exists touch_booking_products on public.booking_products;
create trigger touch_booking_products
before update on public.booking_products
for each row execute function public.touch_updated_at();

alter table public.booking_settings enable row level security;
alter table public.booking_resources enable row level security;
alter table public.booking_services enable row level security;
alter table public.booking_customers enable row level security;
alter table public.booking_bookings enable row level security;
alter table public.booking_availability enable row level security;
alter table public.booking_campaigns enable row level security;
alter table public.booking_products enable row level security;

drop policy if exists "Admins can manage booking settings" on public.booking_settings;
create policy "Admins can manage booking settings"
on public.booking_settings
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking resources" on public.booking_resources;
create policy "Admins can manage booking resources"
on public.booking_resources
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking services" on public.booking_services;
create policy "Admins can manage booking services"
on public.booking_services
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking customers" on public.booking_customers;
create policy "Admins can manage booking customers"
on public.booking_customers
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking bookings" on public.booking_bookings;
create policy "Admins can manage booking bookings"
on public.booking_bookings
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking availability" on public.booking_availability;
create policy "Admins can manage booking availability"
on public.booking_availability
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking campaigns" on public.booking_campaigns;
create policy "Admins can manage booking campaigns"
on public.booking_campaigns
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking products" on public.booking_products;
create policy "Admins can manage booking products"
on public.booking_products
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.booking_settings (key, facility_name, public_url, timezone, address)
values ('default', 'The Grind Baseball Lab', 'https://www.grindbaseballlab.com/book', 'America/New_York', 'Venice, FL')
on conflict (key) do nothing;

insert into public.booking_resources (name, sort_order)
values
  ('Cage 1', 1),
  ('Cage 2', 2),
  ('Pitching Lane', 3),
  ('HitTrax', 4)
on conflict do nothing;

insert into public.booking_availability (weekday, day_name, is_open, start_time, end_time)
values
  (1, 'Monday', true, '09:00', '20:00'),
  (2, 'Tuesday', true, '09:00', '20:00'),
  (3, 'Wednesday', true, '09:00', '20:00'),
  (4, 'Thursday', true, '09:00', '20:00'),
  (5, 'Friday', true, '09:00', '18:00'),
  (6, 'Saturday', true, '09:00', '15:00'),
  (0, 'Sunday', false, '10:00', '14:00')
on conflict (weekday) do nothing;

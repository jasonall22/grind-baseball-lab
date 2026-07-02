alter table public.booking_settings
add column if not exists organization_name text,
add column if not exists country_region text,
add column if not exists address_line_1 text,
add column if not exists address_line_2 text,
add column if not exists city text,
add column if not exists state_region text,
add column if not exists postal_code text,
add column if not exists phone text,
add column if not exists public_calendar_enabled boolean not null default false;

update public.booking_settings
set
  organization_name = coalesce(organization_name, facility_name),
  country_region = coalesce(country_region, 'United States'),
  address_line_1 = coalesce(address_line_1, '613 Cypress Ave'),
  address_line_2 = coalesce(address_line_2, ''),
  city = coalesce(city, 'Venice'),
  state_region = coalesce(state_region, 'Florida'),
  postal_code = coalesce(postal_code, '34285'),
  phone = coalesce(phone, '(941) 525-0880')
where key = 'default';

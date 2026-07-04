alter table public.booking_services
add column if not exists calendar_color text not null default '#4e7cb5';

update public.booking_services
set calendar_color = '#4e7cb5'
where calendar_color is null
   or trim(calendar_color) = '';

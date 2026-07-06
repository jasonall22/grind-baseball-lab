alter table public.booking_services
  add column if not exists instructor_names text[] not null default '{}';

update public.booking_services
set instructor_names = '{}'
where instructor_names is null;

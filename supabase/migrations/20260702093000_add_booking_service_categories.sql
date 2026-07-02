alter table public.booking_services
  add column if not exists service_type text not null default 'rentals'
    check (service_type in ('rentals', 'lessons', 'camps', 'classes', 'memberships', 'packages'));

alter table public.booking_services
  add column if not exists resource_names text[] not null default '{}'::text[];

update public.booking_services
set service_type = case
  when lower(name) like '%lesson%' then 'lessons'
  when lower(name) like '%camp%' then 'camps'
  when lower(name) like '%class%' then 'classes'
  when lower(name) like '%membership%' then 'memberships'
  when lower(name) like '%package%' then 'packages'
  else 'rentals'
end;

update public.booking_services s
set resource_names = array[r.name]
from public.booking_resources r
where s.resource_id = r.id
  and coalesce(array_length(s.resource_names, 1), 0) = 0;

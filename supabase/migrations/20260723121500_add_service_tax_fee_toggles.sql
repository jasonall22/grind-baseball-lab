alter table public.booking_services
  add column if not exists collect_tax boolean not null default false,
  add column if not exists collect_fee boolean not null default false;

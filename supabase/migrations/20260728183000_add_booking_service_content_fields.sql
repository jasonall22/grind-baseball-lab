alter table public.booking_services
  add column if not exists preview_text text not null default '',
  add column if not exists description text not null default '',
  add column if not exists media_url text not null default '';

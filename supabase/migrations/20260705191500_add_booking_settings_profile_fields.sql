alter table public.booking_settings
add column if not exists profile_first_name text,
add column if not exists profile_last_name text,
add column if not exists profile_email text;

update public.booking_settings
set
  profile_first_name = coalesce(profile_first_name, 'Jason'),
  profile_last_name = coalesce(profile_last_name, 'Allaire'),
  profile_email = coalesce(profile_email, 'info@grindbaseballlab.com')
where key = 'default';

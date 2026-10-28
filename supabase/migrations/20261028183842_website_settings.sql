-- Add marketing website settings without changing existing content, accounts, or booking data.
create table public.website_settings (
  key text primary key check (key = 'default'),
  site_name text not null,
  email text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text not null,
  facebook_url text not null check (facebook_url ~ '^https?://'),
  updated_at timestamptz not null default now()
);

alter table public.website_settings enable row level security;
grant select on public.website_settings to anon, authenticated;
grant insert, update on public.website_settings to authenticated;

create policy website_settings_public_read on public.website_settings
  for select to anon, authenticated using (true);
create policy website_settings_admin_insert on public.website_settings
  for insert to authenticated with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );
create policy website_settings_admin_update on public.website_settings
  for update to authenticated using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );

insert into public.website_settings (key,site_name,email,phone,address_line1,address_line2,facebook_url)
values ('default','The Grind Baseball Lab','info@grindbaseballlab.com','(941) 307-7362',
        '613 Cypress Ave','Venice, FL 34285','https://www.facebook.com/profile.php?id=61568109854345');

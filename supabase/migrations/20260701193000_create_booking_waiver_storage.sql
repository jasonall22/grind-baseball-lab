insert into storage.buckets (id, name, public)
values ('booking-waivers', 'booking-waivers', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can read booking waivers" on storage.objects;
create policy "Public can read booking waivers"
on storage.objects
for select
using (bucket_id = 'booking-waivers');

drop policy if exists "Admins can upload booking waivers" on storage.objects;
create policy "Admins can upload booking waivers"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'booking-waivers' and public.is_admin());

drop policy if exists "Admins can update booking waivers" on storage.objects;
create policy "Admins can update booking waivers"
on storage.objects
for update
to authenticated
using (bucket_id = 'booking-waivers' and public.is_admin())
with check (bucket_id = 'booking-waivers' and public.is_admin());

drop policy if exists "Admins can delete booking waivers" on storage.objects;
create policy "Admins can delete booking waivers"
on storage.objects
for delete
to authenticated
using (bucket_id = 'booking-waivers' and public.is_admin());

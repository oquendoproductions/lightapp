begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'domain-icons',
  'domain-icons',
  true,
  2097152,
  array['image/svg+xml', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists domain_icons_public_read on storage.objects;
create policy domain_icons_public_read
on storage.objects
for select
using (
  bucket_id = 'domain-icons'
);

drop policy if exists domain_icons_platform_insert on storage.objects;
create policy domain_icons_platform_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'domain-icons'
  and public.is_platform_admin(auth.uid())
);

drop policy if exists domain_icons_platform_update on storage.objects;
create policy domain_icons_platform_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'domain-icons'
  and public.is_platform_admin(auth.uid())
)
with check (
  bucket_id = 'domain-icons'
  and public.is_platform_admin(auth.uid())
);

drop policy if exists domain_icons_platform_delete on storage.objects;
create policy domain_icons_platform_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'domain-icons'
  and public.is_platform_admin(auth.uid())
);

commit;

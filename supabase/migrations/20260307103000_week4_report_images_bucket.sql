begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-images',
  'report-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'report_images_public_read'
  ) then
    create policy report_images_public_read
      on storage.objects
      for select
      using (bucket_id = 'report-images');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'report_images_public_insert'
  ) then
    create policy report_images_public_insert
      on storage.objects
      for insert
      with check (bucket_id = 'report-images');
  end if;
end$$;

commit;

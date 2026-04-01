begin;

alter table public.tenant_files
  drop constraint if exists tenant_files_file_category_check;

alter table public.tenant_files
  add constraint tenant_files_file_category_check
  check (
    file_category in (
      'contract',
      'asset_coordinates',
      'boundary_geojson',
      'logo',
      'streetlight_inventory',
      'calendar_source',
      'general_asset',
      'other'
    )
  );

grant select, insert, update, delete on public.tenant_files to authenticated;

drop policy if exists tenant_files_select_location_staff on public.tenant_files;
create policy tenant_files_select_location_staff
on public.tenant_files
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.can_manage_tenant_communications(tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'files.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'files.edit')
);

drop policy if exists tenant_files_manage_location_staff on public.tenant_files;
create policy tenant_files_manage_location_staff
on public.tenant_files
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.can_manage_tenant_communications(tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'files.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.can_manage_tenant_communications(tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'files.edit')
);

drop policy if exists tenant_files_location_select on storage.objects;
create policy tenant_files_location_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tenant-files'
  and (
    public.is_platform_admin(auth.uid())
    or public.can_manage_tenant_communications(split_part(name, '/', 1))
    or public.has_tenant_permission(auth.uid(), split_part(name, '/', 1), 'files.access')
    or public.has_tenant_permission(auth.uid(), split_part(name, '/', 1), 'files.edit')
  )
);

drop policy if exists tenant_files_location_insert on storage.objects;
create policy tenant_files_location_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tenant-files'
  and split_part(name, '/', 1) <> ''
  and (
    public.is_platform_admin(auth.uid())
    or public.can_manage_tenant_communications(split_part(name, '/', 1))
    or public.has_tenant_permission(auth.uid(), split_part(name, '/', 1), 'files.edit')
  )
);

drop policy if exists tenant_files_location_update on storage.objects;
create policy tenant_files_location_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tenant-files'
  and split_part(name, '/', 1) <> ''
  and (
    public.is_platform_admin(auth.uid())
    or public.can_manage_tenant_communications(split_part(name, '/', 1))
    or public.has_tenant_permission(auth.uid(), split_part(name, '/', 1), 'files.edit')
  )
)
with check (
  bucket_id = 'tenant-files'
  and split_part(name, '/', 1) <> ''
  and (
    public.is_platform_admin(auth.uid())
    or public.can_manage_tenant_communications(split_part(name, '/', 1))
    or public.has_tenant_permission(auth.uid(), split_part(name, '/', 1), 'files.edit')
  )
);

drop policy if exists tenant_files_location_delete on storage.objects;
create policy tenant_files_location_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tenant-files'
  and split_part(name, '/', 1) <> ''
  and (
    public.is_platform_admin(auth.uid())
    or public.can_manage_tenant_communications(split_part(name, '/', 1))
    or public.has_tenant_permission(auth.uid(), split_part(name, '/', 1), 'files.edit')
  )
);

commit;

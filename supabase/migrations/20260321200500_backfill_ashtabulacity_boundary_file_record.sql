begin;

insert into public.tenant_files (
  tenant_key,
  file_category,
  file_name,
  storage_bucket,
  storage_path,
  mime_type,
  size_bytes,
  uploaded_by,
  notes,
  active
)
select
  'ashtabulacity',
  'boundary_geojson',
  'ashtabula_city_geojson (backfill)',
  'tenant-files',
  'ashtabulacity/boundary_geojson/backfill/ashtabula_city_geojson-backfill.geojson',
  'application/geo+json',
  null,
  null,
  'Backfilled metadata from app_config key ashtabula_city_geojson for platform workspace visibility.',
  true
where exists (
  select 1
  from public.tenants t
  where t.tenant_key = 'ashtabulacity'
)
and exists (
  select 1
  from public.app_config c
  where c.key = 'ashtabula_city_geojson'
)
on conflict (storage_path) do update
set
  file_category = excluded.file_category,
  file_name = excluded.file_name,
  mime_type = excluded.mime_type,
  notes = excluded.notes,
  active = true;

commit;

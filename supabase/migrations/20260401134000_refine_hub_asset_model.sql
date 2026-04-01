begin;

alter table if exists public.tenant_files
  add column if not exists asset_subtype text,
  add column if not exists asset_owner_type text;

alter table if exists public.tenant_files
  drop constraint if exists tenant_files_asset_owner_type_check;

alter table if exists public.tenant_files
  add constraint tenant_files_asset_owner_type_check
  check (
    asset_owner_type is null
    or asset_owner_type in ('organization_owned', 'utility_owned', 'third_party')
  );

alter table if exists public.tenant_files
  drop constraint if exists tenant_files_file_category_check;

alter table if exists public.tenant_files
  add constraint tenant_files_file_category_check
  check (
    file_category in (
      'contract',
      'asset_coordinates',
      'boundary_geojson',
      'logo',
      'calendar_source',
      'asset',
      'general_asset',
      'other'
    )
  );

update public.tenant_files
set
  file_category = 'asset',
  asset_subtype = coalesce(nullif(trim(asset_subtype), ''), 'streetlights'),
  asset_owner_type = coalesce(nullif(trim(asset_owner_type), ''), 'utility_owned')
where file_category = 'streetlight_inventory';

update public.tenant_files
set
  file_category = 'asset',
  asset_subtype = coalesce(nullif(trim(asset_subtype), ''), 'general asset')
where file_category = 'general_asset';

commit;

begin;

alter table if exists public.tenant_map_features
  add column if not exists boundary_border_color text not null default '#e53935';

alter table if exists public.tenant_map_features
  drop constraint if exists tenant_map_features_boundary_border_color_check;

alter table if exists public.tenant_map_features
  add constraint tenant_map_features_boundary_border_color_check
  check (boundary_border_color ~ '^#[0-9A-Fa-f]{6}$');

update public.tenant_map_features
set boundary_border_color = '#e53935'
where boundary_border_color is null
   or boundary_border_color !~ '^#[0-9A-Fa-f]{6}$';

commit;

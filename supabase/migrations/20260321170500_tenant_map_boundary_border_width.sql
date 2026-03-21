begin;

alter table if exists public.tenant_map_features
  add column if not exists boundary_border_width numeric(4,2) not null default 4.00;

alter table if exists public.tenant_map_features
  drop constraint if exists tenant_map_features_boundary_border_width_check;

alter table if exists public.tenant_map_features
  add constraint tenant_map_features_boundary_border_width_check
  check (boundary_border_width >= 0.5 and boundary_border_width <= 8);

update public.tenant_map_features
set boundary_border_width = 4.00
where boundary_border_width is null
   or boundary_border_width < 0.5
   or boundary_border_width > 8;

commit;

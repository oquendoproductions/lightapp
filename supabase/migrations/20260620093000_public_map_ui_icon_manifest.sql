begin;

drop policy if exists app_config_select_boundary_public
on public.app_config;

create policy app_config_select_boundary_public
on public.app_config
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.tenants t
    where t.tenant_key = public.request_tenant_key()
      and t.active = true
      and t.boundary_config_key = app_config.key
  )
  or app_config.key = 'ashtabula_city_geojson'
  or app_config.key = 'public_map_ui_icons_published'
);

commit;

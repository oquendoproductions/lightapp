begin;

-- Ensure tenant-critical tables emit realtime events after restores/clones.
do $$
declare
  t text;
  wanted text[] := array[
    'reports',
    'fixed_lights',
    'light_actions',
    'official_lights',
    'potholes',
    'pothole_reports',
    'water_drain_incidents',
    'incident_state_current',
    'utility_report_status'
  ];
begin
  foreach t in array wanted loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- Public lifecycle reads stay scoped by tenant + visibility config.
drop policy if exists incident_state_current_select_public_visible_domains
on public.incident_state_current;

create policy incident_state_current_select_public_visible_domains
on public.incident_state_current
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.tenant_visibility_config tv
    where tv.tenant_key = public.request_tenant_key()
      and tv.domain = incident_state_current.domain
      and tv.visibility = 'public'
  )
);

-- Boundary gate needs read access to the active tenant boundary key only.
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
);

commit;

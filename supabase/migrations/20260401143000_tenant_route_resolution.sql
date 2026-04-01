begin;

create or replace function public.normalize_tenant_route(input text)
returns text
language sql
immutable
as $$
  select split_part(
    split_part(
      regexp_replace(lower(trim(coalesce(input, ''))), '^https?://', ''),
      '/',
      1
    ),
    ':',
    1
  );
$$;

create or replace function public.resolve_tenant_route(route_input text)
returns table (
  tenant_key text,
  name text,
  primary_subdomain text,
  boundary_config_key text,
  notification_email_potholes text,
  notification_email_water_drain text,
  is_pilot boolean,
  active boolean,
  resident_portal_enabled boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_route text := public.normalize_tenant_route(route_input);
  v_slug text := regexp_replace(split_part(v_route, '.', 1), '[^a-z0-9-]', '', 'g');
  v_host text := case
    when v_route = '' then ''
    when v_route like '%.cityreport.io' then v_route
    when v_slug <> '' then v_slug || '.cityreport.io'
    else ''
  end;
begin
  return query
  select
    t.tenant_key,
    t.name,
    t.primary_subdomain,
    t.boundary_config_key,
    t.notification_email_potholes,
    t.notification_email_water_drain,
    t.is_pilot,
    t.active,
    t.resident_portal_enabled
  from public.tenants t
  where t.active = true
    and (
      lower(t.primary_subdomain) = v_host
      or lower(t.tenant_key) = v_slug
    )
  order by
    case when lower(t.primary_subdomain) = v_host then 0 else 1 end,
    case when lower(t.tenant_key) = v_slug then 0 else 1 end,
    lower(t.tenant_key)
  limit 1;
end;
$$;

grant execute on function public.resolve_tenant_route(text) to anon, authenticated;

create or replace function public.list_active_tenant_routes()
returns table (
  tenant_key text,
  primary_subdomain text,
  route_slug text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.tenant_key,
    t.primary_subdomain,
    regexp_replace(split_part(lower(t.primary_subdomain), '.', 1), '[^a-z0-9-]', '', 'g') as route_slug
  from public.tenants t
  where t.active = true;
$$;

grant execute on function public.list_active_tenant_routes() to anon, authenticated;

commit;

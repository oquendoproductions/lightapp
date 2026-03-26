begin;

create or replace function public.list_resident_hub_tenants()
returns table (
  tenant_key text,
  name text,
  primary_subdomain text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    t.tenant_key,
    t.name,
    t.primary_subdomain
  from public.tenants t
  where t.active = true
  order by t.name asc, t.tenant_key asc;
$$;

grant execute on function public.list_resident_hub_tenants() to authenticated;

commit;

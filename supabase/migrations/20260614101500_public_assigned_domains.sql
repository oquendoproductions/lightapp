begin;

create or replace function public.tenant_assigned_domains_public()
returns table (
  domain_key text,
  label text,
  icon_src text,
  icon_key text,
  report_prefix text,
  domain_type text,
  organization_monitored_repairs boolean
)
language sql
security definer
set search_path = public
as $$
  select
    dd.key as domain_key,
    dd.label,
    coalesce(nullif(dd.icon_src, ''), '') as icon_src,
    coalesce(nullif(dd.icon_key, ''), '') as icon_key,
    dd.report_prefix,
    dd.domain_class as domain_type,
    coalesce(tda.organization_monitored_repairs, dd.default_organization_monitored_repairs, false)
      as organization_monitored_repairs
  from public.tenant_domain_assignments tda
  join public.domain_definitions dd
    on dd.key = tda.domain_key
  where tda.tenant_key = public.request_tenant_key()
    and tda.active = true
    and tda.visibility = 'enabled'
    and dd.status = 'active'
  order by dd.sort_order, dd.label, dd.key;
$$;

grant execute on function public.tenant_assigned_domains_public() to anon, authenticated;

commit;

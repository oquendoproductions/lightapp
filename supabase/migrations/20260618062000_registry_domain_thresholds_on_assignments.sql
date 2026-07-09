begin;

alter table public.tenant_domain_assignments
  add column if not exists public_visibility_min_reports integer not null default 2,
  add column if not exists high_confidence_min_reports integer not null default 4;

update public.tenant_domain_assignments
set
  public_visibility_min_reports = greatest(1, coalesce(public_visibility_min_reports, 2)),
  high_confidence_min_reports = greatest(
    greatest(1, coalesce(public_visibility_min_reports, 2)),
    coalesce(high_confidence_min_reports, 4)
  );

update public.tenant_domain_assignments tda
set
  public_visibility_min_reports = greatest(1, coalesce(tdc.public_visibility_min_reports, tda.public_visibility_min_reports, 2)),
  high_confidence_min_reports = greatest(
    greatest(1, coalesce(tdc.public_visibility_min_reports, tda.public_visibility_min_reports, 2)),
    coalesce(tdc.high_confidence_min_reports, tda.high_confidence_min_reports, 4)
  )
from public.tenant_domain_configs tdc
where tdc.tenant_key = tda.tenant_key
  and tdc.domain::text = tda.domain_key
  and (
    coalesce(tda.public_visibility_min_reports, 2) = 2
    or coalesce(tda.high_confidence_min_reports, 4) = 4
  );

drop function if exists public.tenant_registry_incident_domains_public();

create function public.tenant_registry_incident_domains_public()
returns table (
  domain_key text,
  label text,
  icon_src text,
  report_prefix text,
  allow_report_images boolean,
  domain_type text,
  organization_monitored_repairs boolean,
  public_visibility_min_reports integer,
  high_confidence_min_reports integer
)
language sql
security definer
set search_path = public
as $$
  select
    dd.key as domain_key,
    coalesce(nullif(trim(tda.display_label), ''), dd.label) as label,
    coalesce(nullif(dd.icon_src, ''), nullif(dd.icon_key, ''), '') as icon_src,
    dd.report_prefix,
    dd.allow_report_images,
    dd.domain_class as domain_type,
    coalesce(tda.organization_monitored_repairs, dd.default_organization_monitored_repairs, false)
      as organization_monitored_repairs,
    greatest(1, coalesce(tda.public_visibility_min_reports, 2))::int as public_visibility_min_reports,
    greatest(
      greatest(1, coalesce(tda.public_visibility_min_reports, 2)),
      coalesce(tda.high_confidence_min_reports, 4)
    )::int as high_confidence_min_reports
  from public.tenant_domain_assignments tda
  join public.domain_definitions dd
    on dd.key = tda.domain_key
  where tda.tenant_key = public.request_tenant_key()
    and tda.active = true
    and tda.visibility = 'enabled'
    and dd.status = 'active'
    and dd.domain_class = 'incident_driven'
  order by dd.sort_order, dd.label, dd.key;
$$;

grant execute on function public.tenant_registry_incident_domains_public() to anon, authenticated;

drop function if exists public.tenant_assigned_domains_public();

create function public.tenant_assigned_domains_public()
returns table (
  domain_key text,
  label text,
  icon_src text,
  icon_key text,
  report_prefix text,
  allow_report_images boolean,
  domain_type text,
  organization_monitored_repairs boolean,
  public_visibility_min_reports integer,
  high_confidence_min_reports integer
)
language sql
security definer
set search_path = public
as $$
  select
    dd.key as domain_key,
    coalesce(nullif(trim(tda.display_label), ''), dd.label) as label,
    coalesce(nullif(dd.icon_src, ''), '') as icon_src,
    coalesce(nullif(dd.icon_key, ''), '') as icon_key,
    dd.report_prefix,
    dd.allow_report_images,
    dd.domain_class as domain_type,
    coalesce(tda.organization_monitored_repairs, dd.default_organization_monitored_repairs, false)
      as organization_monitored_repairs,
    greatest(1, coalesce(tda.public_visibility_min_reports, 2))::int as public_visibility_min_reports,
    greatest(
      greatest(1, coalesce(tda.public_visibility_min_reports, 2)),
      coalesce(tda.high_confidence_min_reports, 4)
    )::int as high_confidence_min_reports
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

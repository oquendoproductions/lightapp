begin;

alter table public.tenant_domain_configs
  add column if not exists public_visibility_min_reports integer not null default 2,
  add column if not exists high_confidence_min_reports integer not null default 4;

update public.tenant_domain_configs
set
  public_visibility_min_reports = greatest(1, coalesce(public_visibility_min_reports, 2)),
  high_confidence_min_reports = greatest(
    greatest(1, coalesce(public_visibility_min_reports, 2)),
    coalesce(high_confidence_min_reports, 4)
  );

drop function if exists public.tenant_domain_public_config();

create or replace function public.tenant_domain_public_config()
returns table (
  domain public.incident_domain,
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
    c.domain,
    c.domain_type,
    c.organization_monitored_repairs,
    greatest(1, coalesce(c.public_visibility_min_reports, 2))::int as public_visibility_min_reports,
    greatest(
      greatest(1, coalesce(c.public_visibility_min_reports, 2)),
      coalesce(c.high_confidence_min_reports, 4)
    )::int as high_confidence_min_reports
  from public.tenant_domain_configs c
  where c.tenant_key = public.request_tenant_key()
  order by c.domain;
$$;

grant execute on function public.tenant_domain_public_config() to anon, authenticated;

commit;

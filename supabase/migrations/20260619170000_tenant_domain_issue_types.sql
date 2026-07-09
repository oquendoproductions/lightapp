begin;

create table if not exists public.tenant_domain_issue_types (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  domain_key text not null references public.domain_definitions(key) on delete cascade,
  issue_key text not null
    check (issue_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  issue_label text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_key, domain_key, issue_key)
);

drop trigger if exists trg_tenant_domain_issue_types_updated_at on public.tenant_domain_issue_types;
create trigger trg_tenant_domain_issue_types_updated_at
before update on public.tenant_domain_issue_types
for each row
execute function public.touch_platform_control_plane_updated_at();

alter table public.tenant_domain_issue_types enable row level security;

grant select, insert, update, delete on public.tenant_domain_issue_types to authenticated;

drop policy if exists tenant_domain_issue_types_select on public.tenant_domain_issue_types;
create policy tenant_domain_issue_types_select
on public.tenant_domain_issue_types
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.access')
  or public.has_platform_permission(auth.uid(), 'domains.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
);

drop policy if exists tenant_domain_issue_types_manage on public.tenant_domain_issue_types;
create policy tenant_domain_issue_types_manage
on public.tenant_domain_issue_types
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
);

create index if not exists idx_tenant_domain_issue_types_tenant_domain_sort
  on public.tenant_domain_issue_types(tenant_key, domain_key, active, sort_order);

insert into public.tenant_domain_issue_types (
  tenant_key,
  domain_key,
  issue_key,
  issue_label,
  sort_order,
  active
)
select
  tda.tenant_key,
  tda.domain_key,
  dit.issue_key,
  dit.issue_label,
  dit.sort_order,
  dit.active
from public.tenant_domain_assignments tda
join public.domain_issue_types dit
  on dit.domain_key = tda.domain_key
on conflict (tenant_key, domain_key, issue_key) do update
set
  issue_label = excluded.issue_label,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

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
  marker_color text,
  public_visibility_min_reports integer,
  high_confidence_min_reports integer,
  issue_types jsonb
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
    nullif(trim(tda.marker_color), '') as marker_color,
    greatest(1, coalesce(tda.public_visibility_min_reports, 2))::int as public_visibility_min_reports,
    greatest(
      greatest(1, coalesce(tda.public_visibility_min_reports, 2)),
      coalesce(tda.high_confidence_min_reports, 4)
    )::int as high_confidence_min_reports,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'issue_key', tdit.issue_key,
          'issue_label', tdit.issue_label,
          'sort_order', tdit.sort_order
        )
        order by tdit.sort_order, tdit.issue_label, tdit.issue_key
      )
      from public.tenant_domain_issue_types tdit
      where tdit.tenant_key = tda.tenant_key
        and tdit.domain_key = dd.key
        and tdit.active = true
    ), '[]'::jsonb) as issue_types
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
  marker_color text,
  public_visibility_min_reports integer,
  high_confidence_min_reports integer,
  issue_types jsonb
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
    nullif(trim(tda.marker_color), '') as marker_color,
    greatest(1, coalesce(tda.public_visibility_min_reports, 2))::int as public_visibility_min_reports,
    greatest(
      greatest(1, coalesce(tda.public_visibility_min_reports, 2)),
      coalesce(tda.high_confidence_min_reports, 4)
    )::int as high_confidence_min_reports,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'issue_key', tdit.issue_key,
          'issue_label', tdit.issue_label,
          'sort_order', tdit.sort_order
        )
        order by tdit.sort_order, tdit.issue_label, tdit.issue_key
      )
      from public.tenant_domain_issue_types tdit
      where tdit.tenant_key = tda.tenant_key
        and tdit.domain_key = dd.key
        and tdit.active = true
    ), '[]'::jsonb) as issue_types
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

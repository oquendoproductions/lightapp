begin;

create table if not exists public.domain_type_options (
  id uuid primary key default gen_random_uuid(),
  domain_key text not null references public.domain_definitions(key) on delete cascade,
  type_key text not null
    check (type_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  type_label text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain_key, type_key)
);

drop trigger if exists trg_domain_type_options_updated_at on public.domain_type_options;
create trigger trg_domain_type_options_updated_at
before update on public.domain_type_options
for each row
execute function public.touch_platform_control_plane_updated_at();

alter table public.domain_type_options enable row level security;
grant select, insert, update, delete on public.domain_type_options to authenticated;

drop policy if exists domain_type_options_select on public.domain_type_options;
create policy domain_type_options_select
on public.domain_type_options
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.access')
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

drop policy if exists domain_type_options_manage on public.domain_type_options;
create policy domain_type_options_manage
on public.domain_type_options
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

create index if not exists idx_domain_type_options_domain_sort
  on public.domain_type_options(domain_key, active, sort_order);

insert into public.domain_type_options (domain_key, type_key, type_label, sort_order)
values
  ('street_signs', 'stop', 'Stop', 10),
  ('street_signs', 'yield', 'Yield', 20),
  ('street_signs', 'speed_limit', 'Speed limit', 30),
  ('street_signs', 'warning', 'Warning', 40),
  ('street_signs', 'no_parking', 'No parking', 50),
  ('street_signs', 'one_way', 'One way', 60),
  ('street_signs', 'school_zone', 'School zone', 70),
  ('street_signs', 'crosswalk', 'Crosswalk', 80),
  ('street_signs', 'street_name', 'Street name', 90),
  ('street_signs', 'other', 'Other', 100)
on conflict (domain_key, type_key) do update
set
  type_label = excluded.type_label,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

drop function if exists public.tenant_registry_incident_domains_public();

create function public.tenant_registry_incident_domains_public()
returns table (
  domain_key text,
  label text,
  icon_src text,
  icon_render_mode text,
  icon_tint_mode text,
  icon_tint_color text,
  report_prefix text,
  allow_report_images boolean,
  road_required boolean,
  domain_type text,
  organization_monitored_repairs boolean,
  marker_color text,
  public_visibility_min_reports integer,
  high_confidence_min_reports integer,
  issue_types jsonb,
  type_options jsonb,
  report_disclosures jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    dd.key as domain_key,
    coalesce(nullif(trim(tda.display_label), ''), dd.label) as label,
    coalesce(nullif(dd.icon_src, ''), nullif(dd.icon_key, ''), '') as icon_src,
    coalesce(nullif(trim(tda.icon_render_mode), ''), case when coalesce(dd.icon_src, '') ~* '\.svg(?:[?#].*)?$' then 'tintable_svg' else 'raster' end) as icon_render_mode,
    coalesce(nullif(trim(tda.icon_tint_mode), ''), 'auto_contrast') as icon_tint_mode,
    nullif(trim(tda.icon_tint_color), '') as icon_tint_color,
    dd.report_prefix,
    dd.allow_report_images,
    dd.road_required,
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
    ), '[]'::jsonb) as issue_types,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type_key', dto.type_key,
          'type_label', dto.type_label,
          'sort_order', dto.sort_order
        )
        order by dto.sort_order, dto.type_label, dto.type_key
      )
      from public.domain_type_options dto
      where dto.domain_key = dd.key
        and dto.active = true
    ), '[]'::jsonb) as type_options,
    coalesce(tda.report_disclosures, '[]'::jsonb) as report_disclosures
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
  icon_render_mode text,
  icon_tint_mode text,
  icon_tint_color text,
  report_prefix text,
  allow_report_images boolean,
  road_required boolean,
  domain_type text,
  organization_monitored_repairs boolean,
  marker_color text,
  public_visibility_min_reports integer,
  high_confidence_min_reports integer,
  issue_types jsonb,
  type_options jsonb,
  report_disclosures jsonb
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
    coalesce(nullif(trim(tda.icon_render_mode), ''), case when coalesce(dd.icon_src, '') ~* '\.svg(?:[?#].*)?$' then 'tintable_svg' else 'raster' end) as icon_render_mode,
    coalesce(nullif(trim(tda.icon_tint_mode), ''), 'auto_contrast') as icon_tint_mode,
    nullif(trim(tda.icon_tint_color), '') as icon_tint_color,
    dd.report_prefix,
    dd.allow_report_images,
    dd.road_required,
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
    ), '[]'::jsonb) as issue_types,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type_key', dto.type_key,
          'type_label', dto.type_label,
          'sort_order', dto.sort_order
        )
        order by dto.sort_order, dto.type_label, dto.type_key
      )
      from public.domain_type_options dto
      where dto.domain_key = dd.key
        and dto.active = true
    ), '[]'::jsonb) as type_options,
    coalesce(tda.report_disclosures, '[]'::jsonb) as report_disclosures
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

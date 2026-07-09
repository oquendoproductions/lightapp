begin;

alter table public.tenant_domain_configs
  add column if not exists high_confidence_icon_tint_mode text
    check (high_confidence_icon_tint_mode in ('default', 'auto_contrast', 'custom')),
  add column if not exists high_confidence_icon_tint_color text;

alter table public.tenant_domain_assignments
  add column if not exists high_confidence_icon_tint_mode text
    check (high_confidence_icon_tint_mode in ('default', 'auto_contrast', 'custom')),
  add column if not exists high_confidence_icon_tint_color text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_domain_configs'
      and column_name = 'icon_tint_mode'
  ) then
    execute $sql$
      update public.tenant_domain_configs
      set
        high_confidence_icon_tint_mode = coalesce(nullif(trim(icon_tint_mode), ''), 'auto_contrast'),
        high_confidence_icon_tint_color = nullif(trim(icon_tint_color), '')
      where domain in ('streetlights', 'street_signs')
        and (
          nullif(trim(high_confidence_icon_tint_mode), '') is null
          or nullif(trim(high_confidence_icon_tint_color), '') is null
        )
    $sql$;
  else
    update public.tenant_domain_configs
    set
      high_confidence_icon_tint_mode = coalesce(nullif(trim(high_confidence_icon_tint_mode), ''), 'auto_contrast'),
      high_confidence_icon_tint_color = nullif(trim(high_confidence_icon_tint_color), '')
    where domain in ('streetlights', 'street_signs')
      and (
        nullif(trim(high_confidence_icon_tint_mode), '') is null
        or nullif(trim(high_confidence_icon_tint_color), '') is null
      );
  end if;
end
$$;

update public.tenant_domain_assignments
set
  high_confidence_icon_tint_mode = coalesce(nullif(trim(icon_tint_mode), ''), 'auto_contrast'),
  high_confidence_icon_tint_color = nullif(trim(icon_tint_color), '')
where domain_key in ('streetlights', 'street_signs')
  and (
    nullif(trim(high_confidence_icon_tint_mode), '') is null
    or nullif(trim(high_confidence_icon_tint_color), '') is null
  );

drop function if exists public.tenant_domain_public_config();

create or replace function public.tenant_domain_public_config()
returns table (
  domain public.incident_domain,
  domain_type text,
  organization_monitored_repairs boolean,
  public_visibility_min_reports integer,
  high_confidence_min_reports integer,
  high_confidence_marker_color text,
  high_confidence_icon_tint_mode text,
  high_confidence_icon_tint_color text
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
    )::int as high_confidence_min_reports,
    nullif(trim(c.high_confidence_marker_color), '') as high_confidence_marker_color,
    coalesce(nullif(trim(c.high_confidence_icon_tint_mode), ''), 'auto_contrast') as high_confidence_icon_tint_mode,
    nullif(trim(c.high_confidence_icon_tint_color), '') as high_confidence_icon_tint_color
  from public.tenant_domain_configs c
  where c.tenant_key = public.request_tenant_key()
  order by c.domain;
$$;

grant execute on function public.tenant_domain_public_config() to anon, authenticated;

drop function if exists public.tenant_registry_incident_domains_public();

create function public.tenant_registry_incident_domains_public()
returns table (
  domain_key text,
  label text,
  icon_src text,
  icon_render_mode text,
  icon_tint_mode text,
  icon_tint_color text,
  high_confidence_icon_tint_mode text,
  high_confidence_icon_tint_color text,
  report_prefix text,
  allow_report_images boolean,
  road_required boolean,
  domain_type text,
  organization_monitored_repairs boolean,
  marker_color text,
  high_confidence_marker_color text,
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
    coalesce(nullif(trim(tda.high_confidence_icon_tint_mode), ''), nullif(trim(tda.icon_tint_mode), ''), 'auto_contrast') as high_confidence_icon_tint_mode,
    coalesce(nullif(trim(tda.high_confidence_icon_tint_color), ''), nullif(trim(tda.icon_tint_color), '')) as high_confidence_icon_tint_color,
    dd.report_prefix,
    dd.allow_report_images,
    dd.road_required,
    dd.domain_class as domain_type,
    coalesce(tda.organization_monitored_repairs, dd.default_organization_monitored_repairs, false)
      as organization_monitored_repairs,
    nullif(trim(tda.marker_color), '') as marker_color,
    nullif(trim(tda.high_confidence_marker_color), '') as high_confidence_marker_color,
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
  high_confidence_icon_tint_mode text,
  high_confidence_icon_tint_color text,
  report_prefix text,
  allow_report_images boolean,
  road_required boolean,
  domain_type text,
  organization_monitored_repairs boolean,
  marker_color text,
  high_confidence_marker_color text,
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
    coalesce(nullif(trim(tda.high_confidence_icon_tint_mode), ''), nullif(trim(tda.icon_tint_mode), ''), 'auto_contrast') as high_confidence_icon_tint_mode,
    coalesce(nullif(trim(tda.high_confidence_icon_tint_color), ''), nullif(trim(tda.icon_tint_color), '')) as high_confidence_icon_tint_color,
    dd.report_prefix,
    dd.allow_report_images,
    dd.road_required,
    dd.domain_class as domain_type,
    coalesce(tda.organization_monitored_repairs, dd.default_organization_monitored_repairs, false)
      as organization_monitored_repairs,
    nullif(trim(tda.marker_color), '') as marker_color,
    nullif(trim(tda.high_confidence_marker_color), '') as high_confidence_marker_color,
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

begin;

alter table public.domain_definitions
  add column if not exists type_options jsonb not null default '[]'::jsonb;

update public.domain_definitions dd
set type_options = grouped.type_options
from (
  select
    dto.domain_key,
    jsonb_build_array(
      jsonb_build_object(
        'id', concat(dto.domain_key, '_type_option_1'),
        'option_key', case when dto.domain_key = 'street_signs' then 'sign_type' else 'type_option_1' end,
        'option_label', case when dto.domain_key = 'street_signs' then 'Sign Type' else 'Type Option 1' end,
        'choices', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'value', dto.type_key,
              'label', dto.type_label,
              'sort_order', dto.sort_order
            )
            order by dto.sort_order, dto.type_label, dto.type_key
          ),
          '[]'::jsonb
        )
      )
    ) as type_options
  from public.domain_type_options dto
  where dto.active = true
  group by dto.domain_key
) grouped
where dd.key = grouped.domain_key
  and (
    coalesce(jsonb_typeof(dd.type_options), '') <> 'array'
    or coalesce(jsonb_array_length(dd.type_options), 0) = 0
  );

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
    coalesce(dd.type_options, '[]'::jsonb) as type_options,
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
    coalesce(dd.type_options, '[]'::jsonb) as type_options,
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

begin;

alter table public.tenant_domain_assignments
  add column if not exists report_disclosures jsonb not null default '[]'::jsonb;

update public.tenant_domain_assignments
set report_disclosures = case
  when coalesce(jsonb_typeof(report_disclosures), '') = 'array'
    and coalesce(jsonb_array_length(report_disclosures), 0) > 0
    then report_disclosures
  when domain_key = 'potholes' then jsonb_build_array(
    jsonb_build_object(
      'id', 'potholes_vehicle_damage_notice',
      'title', 'Vehicle damage notice',
      'body', 'If you need to report damage to your vehicle from a pothole, you will need to file a police report as soon as possible, then bring this information to the City Manager''s Office.',
      'required_acknowledgement', false,
      'display_position', 'before_form'
    ),
    jsonb_build_object(
      'id', 'potholes_submit_authorization',
      'title', 'Authorization to submit',
      'body', 'I agree to allow CityReport.io to submit this pothole report and my provided contact information to the city, utility, or other responsible agency on my behalf, and I confirm the submitted information is accurate to the best of my knowledge.',
      'required_acknowledgement', true,
      'display_position', 'inside_form'
    ),
    jsonb_build_object(
      'id', 'potholes_submission_notice',
      'title', 'Submission notice',
      'body', 'Submitting a report through CityReport helps notify the city, but it does not guarantee receipt, review, response, or acceptance as legal notice. For emergencies or immediate hazards, contact emergency services or the responsible agency directly.',
      'required_acknowledgement', false,
      'display_position', 'inside_form'
    )
  )
  when domain_key = 'water_drain_issues' then jsonb_build_array(
    jsonb_build_object(
      'id', 'water_drain_submit_authorization',
      'title', 'Authorization to submit',
      'body', 'I agree to allow CityReport.io to submit this water or drainage issue and my provided contact information to the city, utility, or other responsible agency on my behalf, and I confirm the submitted information is accurate to the best of my knowledge.',
      'required_acknowledgement', true,
      'display_position', 'inside_form'
    ),
    jsonb_build_object(
      'id', 'water_drain_submission_notice',
      'title', 'Submission notice',
      'body', 'Submitting a report through CityReport helps notify the city, but it does not guarantee receipt, review, response, or acceptance as legal notice. Sewer, storm, or drainage issues may require immediate direct contact with the city or utility. For emergencies, call 911.',
      'required_acknowledgement', false,
      'display_position', 'inside_form'
    )
  )
  else jsonb_build_array(
    jsonb_build_object(
      'id', 'standard_submission_notice',
      'title', 'Submission notice',
      'body', 'Submitting a report through CityReport helps notify the city, but it does not guarantee receipt, review, response, or acceptance as legal notice. For emergencies or immediate hazards, contact emergency services or the responsible agency directly.',
      'required_acknowledgement', false,
      'display_position', 'inside_form'
    )
  )
end
where coalesce(jsonb_typeof(report_disclosures), '') <> 'array'
   or coalesce(jsonb_array_length(report_disclosures), 0) = 0;

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
  issue_types jsonb,
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
    ), '[]'::jsonb) as issue_types,
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
  report_prefix text,
  allow_report_images boolean,
  domain_type text,
  organization_monitored_repairs boolean,
  marker_color text,
  public_visibility_min_reports integer,
  high_confidence_min_reports integer,
  issue_types jsonb,
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
    ), '[]'::jsonb) as issue_types,
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

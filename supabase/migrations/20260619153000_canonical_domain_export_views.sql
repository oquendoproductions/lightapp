begin;

create or replace function public.normalize_incident_domain_key(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $function$
declare
  normalized text := nullif(
    regexp_replace(lower(trim(coalesce(p_raw, ''))), '[^a-z0-9]+', '_', 'g'),
    ''
  );
begin
  if normalized is null then
    return null;
  end if;

  return case normalized
    when 'streetlight' then 'streetlights'
    when 'pothole' then 'potholes'
    when 'street_sign' then 'street_signs'
    when 'street_signs' then 'street_signs'
    when 'water_drain' then 'water_drain_issues'
    when 'water_drain_issue' then 'water_drain_issues'
    when 'drain_issues' then 'water_drain_issues'
    when 'storm_drain' then 'water_drain_issues'
    when 'sewer_backup' then 'water_drain_issues'
    when 'power' then 'power_outage'
    when 'outage' then 'power_outage'
    when 'water_main_break' then 'water_main'
    else normalized
  end;
end;
$function$;

create or replace function public.resolve_canonical_incident_domain_key(
  p_lifecycle_domain text default null,
  p_incident_id text default null,
  p_report_domain text default null,
  p_report_type text default null
)
returns text
language plpgsql
stable
set search_path = public
as $function$
declare
  lifecycle_key text := public.normalize_incident_domain_key(p_lifecycle_domain);
  incident_id_text text := lower(trim(coalesce(p_incident_id, '')));
  incident_has_domain_prefix boolean := position(':' in incident_id_text) > 0;
  incident_prefix text := case
    when incident_has_domain_prefix
      then public.normalize_incident_domain_key(split_part(incident_id_text, ':', 1))
    else null
  end;
  report_key text := public.normalize_incident_domain_key(p_report_domain);
  type_key text := public.normalize_incident_domain_key(p_report_type);
begin
  if report_key is not null and exists (
    select 1
    from public.domain_definitions dd
    where dd.key = report_key
  ) then
    return report_key;
  end if;

  if incident_prefix is not null and exists (
    select 1
    from public.domain_definitions dd
    where dd.key = incident_prefix
  ) then
    return incident_prefix;
  end if;

  if lifecycle_key is not null and lifecycle_key <> 'streetlights' then
    return lifecycle_key;
  end if;

  if report_key is not null then
    return report_key;
  end if;

  if incident_has_domain_prefix and incident_prefix is not null then
    return incident_prefix;
  end if;

  if lifecycle_key is not null then
    return lifecycle_key;
  end if;

  if type_key = 'potholes' then return 'potholes'; end if;
  if type_key = 'street_signs' then return 'street_signs'; end if;
  if type_key = 'water_drain_issues' then return 'water_drain_issues'; end if;
  if type_key = 'power_outage' then return 'power_outage'; end if;
  if type_key = 'water_main' then return 'water_main'; end if;

  return 'streetlights';
end;
$function$;

drop view if exists public.internal_metrics_view;
drop view if exists public.public_metrics_view;
drop view if exists public.internal_metrics_accountability_v1;
drop view if exists public.public_metrics_summary_v1;
drop view if exists public.export_incident_detail_v1;
drop view if exists public.export_incident_summary_v1;

create or replace view public.export_incident_summary_v1 as
with canonical_metrics as (
  select
    public.resolve_canonical_incident_domain_key(m.domain::text, m.incident_id, null, null) as domain,
    m.incident_id,
    m.current_state,
    m.last_state_change_at as last_changed_at,
    m.reopen_count,
    case when m.current_state in ('fixed', 'archived') then false else true end as is_open,
    m.first_reported_at,
    m.first_confirmed_at,
    m.first_fixed_at,
    m.time_to_confirm_seconds,
    m.time_to_fix_seconds,
    m.is_chronic,
    m.incident_id as aggregation_id
  from public.incident_timeline_metrics_v1 m
)
select *
from canonical_metrics;

create or replace view public.export_incident_detail_v1 as
with metrics as (
  select
    m.domain::text as lifecycle_domain,
    public.resolve_canonical_incident_domain_key(m.domain::text, m.incident_id, null, null) as domain,
    m.incident_id,
    m.current_state,
    m.last_changed_at,
    m.reopen_count,
    m.first_reported_at,
    m.first_confirmed_at,
    m.first_fixed_at,
    m.last_state_change_at,
    m.time_to_confirm_seconds,
    m.time_to_fix_seconds,
    m.is_chronic
  from public.incident_timeline_metrics_v1 m
),
reports_bad as (
  select
    r.id as report_id,
    r.report_number,
    public.resolve_canonical_incident_domain_key(
      public.map_incident_domain_from_report(r.light_id, r.report_domain, r.report_type)::text,
      r.light_id,
      r.report_domain,
      r.report_type
    ) as domain,
    public.map_incident_domain_from_report(r.light_id, r.report_domain, r.report_type)::text as lifecycle_domain,
    r.light_id as incident_id,
    r.created_at as submitted_at,
    r.note as notes,
    r.reporter_name,
    r.reporter_email,
    r.reporter_phone,
    r.reporter_user_id
  from public.reports r
  where coalesce(lower(r.report_quality), 'bad') = 'bad'
),
potholes as (
  select
    p.id as report_id,
    p.report_number,
    'potholes'::text as domain,
    'potholes'::text as lifecycle_domain,
    ('pothole:' || p.pothole_id)::text as incident_id,
    p.created_at as submitted_at,
    p.note as notes,
    p.reporter_name,
    p.reporter_email,
    p.reporter_phone,
    p.reporter_user_id
  from public.pothole_reports p
),
all_rows as (
  select * from reports_bad
  union all
  select * from potholes
)
select
  a.report_id as source_report_id,
  a.report_number,
  a.domain,
  a.incident_id,
  a.submitted_at as submission_timestamp,
  m.first_fixed_at as fix_timestamp,
  m.time_to_fix_seconds as time_to_close_seconds,
  m.current_state,
  a.reporter_name,
  a.reporter_email,
  a.reporter_phone,
  a.notes as note,
  'user'::text as source,
  a.report_id,
  a.submitted_at,
  m.first_reported_at,
  m.first_confirmed_at,
  m.first_fixed_at as fixed_at,
  m.last_state_change_at,
  m.time_to_confirm_seconds,
  m.time_to_fix_seconds,
  m.reopen_count,
  m.is_chronic,
  a.reporter_user_id,
  a.notes,
  a.incident_id as aggregation_id
from all_rows a
left join metrics m
  on m.lifecycle_domain = a.lifecycle_domain
 and m.incident_id = a.incident_id;

create or replace view public.public_metrics_summary_v1 as
select
  s.domain,
  count(*) filter (where s.current_state in ('fixed', 'archived'))::bigint as closed_count,
  count(*) filter (where s.current_state not in ('fixed', 'archived'))::bigint as open_count,
  round(avg(s.time_to_fix_seconds) filter (where s.time_to_fix_seconds is not null)::numeric, 0)::bigint as avg_time_to_fix_seconds,
  case
    when count(*) = 0 then 0::numeric
    else round((sum(case when s.reopen_count > 0 then 1 else 0 end)::numeric / count(*)::numeric) * 100, 2)
  end as reopen_rate_percent,
  max(s.last_changed_at) as last_updated_at
from public.export_incident_summary_v1 s
join public.tenant_visibility_config tv
  on tv.tenant_key = 'default'
 and tv.domain::text = s.domain
 and tv.visibility = 'public'
group by s.domain
order by s.domain;

create or replace view public.internal_metrics_accountability_v1 as
with canonical_metrics as (
  select
    public.resolve_canonical_incident_domain_key(m.domain::text, m.incident_id, null, null) as domain,
    m.incident_id,
    m.current_state,
    m.first_reported_at,
    m.first_confirmed_at,
    m.first_fixed_at,
    m.last_state_change_at,
    m.time_to_confirm_seconds,
    m.time_to_fix_seconds,
    m.reopen_count,
    m.is_chronic
  from public.incident_timeline_metrics_v1 m
),
report_counts as (
  select domain, incident_id, count(*)::bigint as report_count
  from public.export_incident_detail_v1
  group by domain, incident_id
),
ranked as (
  select
    m.domain,
    m.incident_id,
    m.current_state,
    m.first_reported_at,
    m.first_confirmed_at,
    m.first_fixed_at,
    m.last_state_change_at,
    m.time_to_confirm_seconds,
    m.time_to_fix_seconds,
    m.reopen_count,
    m.is_chronic,
    coalesce(rc.report_count, 0) as report_count,
    m.incident_id as aggregation_id,
    dense_rank() over (
      partition by m.domain
      order by coalesce(rc.report_count, 0) desc, m.last_state_change_at desc nulls last
    ) as recurrence_rank
  from canonical_metrics m
  left join report_counts rc
    on rc.domain = m.domain
   and rc.incident_id = m.incident_id
)
select *
from ranked;

create or replace view public.public_metrics_view as
select
  domain,
  open_count,
  closed_count,
  avg_time_to_fix_seconds,
  reopen_rate_percent,
  last_updated_at
from public.public_metrics_summary_v1;

create or replace view public.internal_metrics_view as
select *
from public.internal_metrics_accountability_v1
where exists (
  select 1
  from public.admins a
  where a.user_id = auth.uid()
);

revoke all on public.public_metrics_view from public;
revoke all on public.internal_metrics_view from public;
revoke all on public.internal_metrics_accountability_v1 from anon, authenticated;

grant select on public.export_incident_summary_v1 to anon, authenticated;
grant select on public.export_incident_detail_v1 to anon, authenticated;
grant select on public.public_metrics_summary_v1 to anon, authenticated;
grant select on public.internal_metrics_accountability_v1 to authenticated;
grant select on public.public_metrics_view to anon, authenticated;
grant select on public.internal_metrics_view to authenticated;

commit;

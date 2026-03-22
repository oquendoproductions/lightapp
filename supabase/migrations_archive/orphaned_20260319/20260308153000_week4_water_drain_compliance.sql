begin;

-- 1) Extend lifecycle enum for contract-native municipal water/drain domain.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'incident_domain'
      and e.enumlabel = 'water_drain_issues'
  ) then
    alter type public.incident_domain add value 'water_drain_issues';
  end if;
end
$$;

-- 2) Ensure water/drain subtype can be persisted directly in reports.report_type.
alter table if exists public.reports
  add column if not exists report_source text;

alter table if exists public.pothole_reports
  add column if not exists report_source text;

update public.reports r
set report_source = case
  when exists (select 1 from public.admins a where a.user_id = r.reporter_user_id) then 'municipal_staff'
  when coalesce(r.reporter_user_id::text, '') <> '' then 'citizen'
  else 'citizen'
end
where coalesce(trim(r.report_source), '') = '';

update public.pothole_reports p
set report_source = case
  when exists (select 1 from public.admins a where a.user_id = p.reporter_user_id) then 'municipal_staff'
  when coalesce(p.reporter_user_id::text, '') <> '' then 'citizen'
  else 'citizen'
end
where coalesce(trim(p.report_source), '') = '';

alter table if exists public.reports
  alter column report_source set default 'citizen';

alter table if exists public.pothole_reports
  alter column report_source set default 'citizen';

alter table if exists public.reports
  alter column report_source set not null;

alter table if exists public.pothole_reports
  alter column report_source set not null;

alter table if exists public.reports
  drop constraint if exists reports_report_source_check;

alter table if exists public.reports
  add constraint reports_report_source_check
  check (report_source in ('citizen', 'municipal_staff', 'system'));

alter table if exists public.pothole_reports
  drop constraint if exists pothole_reports_report_source_check;

alter table if exists public.pothole_reports
  add constraint pothole_reports_report_source_check
  check (report_source in ('citizen', 'municipal_staff', 'system'));

alter table if exists public.reports
  drop constraint if exists reports_report_type_check;

alter table if exists public.reports
  add constraint reports_report_type_check
  check (
    report_type is null
    or lower(trim(report_type)) in (
      'out',
      'outage',
      'flickering',
      'dayburner',
      'downed_pole',
      'downed-pole',
      'pole_down',
      'working',
      'reported_working',
      'is_working',
      'other',
      'damaged',
      'missing',
      'blocked',
      'faded',
      'bent',
      'graffiti',
      'wrong_sign',
      'sewer_backup',
      'storm_drain_clog'
    )
  ) not valid;

-- 3) Domain mapping updates for lifecycle/event integrity.
create or replace function public.map_incident_domain_from_light_id(p_light_id text)
returns public.incident_domain
language plpgsql
stable
as $$
declare
  v text := lower(trim(coalesce(p_light_id, '')));
begin
  if v like 'potholes:%' or v like 'pothole:%' then
    return 'potholes'::public.incident_domain;
  elsif v like 'street_signs:%' or v like 'street_sign:%' then
    return 'street_signs'::public.incident_domain;
  elsif v like 'water_drain_issues:%' or v like 'water_drain:%' or v like 'storm_drain:%' or v like 'sewer_backup:%' then
    return 'water_drain_issues'::public.incident_domain;
  elsif v like 'power_outage:%' then
    return 'power_outage'::public.incident_domain;
  elsif v like 'water_main:%' then
    return 'water_main'::public.incident_domain;
  end if;

  if exists (select 1 from public.official_signs s where s.id::text = v) then
    return 'street_signs'::public.incident_domain;
  end if;

  return 'streetlights'::public.incident_domain;
end;
$$;

create or replace function public.map_incident_domain_from_report(
  p_light_id text,
  p_report_domain text,
  p_report_type text
)
returns public.incident_domain
language plpgsql
stable
as $$
declare
  lid text := lower(trim(coalesce(p_light_id, '')));
  d text := lower(trim(coalesce(p_report_domain, '')));
  t text := lower(trim(coalesce(p_report_type, '')));
begin
  if lid like 'potholes:%' then return 'potholes'::public.incident_domain; end if;
  if lid like 'street_signs:%' then return 'street_signs'::public.incident_domain; end if;
  if lid like 'water_drain_issues:%' or lid like 'water_drain:%' or lid like 'storm_drain:%' or lid like 'sewer_backup:%' then return 'water_drain_issues'::public.incident_domain; end if;
  if lid like 'power_outage:%' then return 'power_outage'::public.incident_domain; end if;
  if lid like 'water_main:%' then return 'water_main'::public.incident_domain; end if;
  if exists (select 1 from public.official_signs s where s.id::text = lid) then return 'street_signs'::public.incident_domain; end if;

  if d in ('streetlights','streetlight') then return 'streetlights'::public.incident_domain; end if;
  if d in ('street_signs','street signs','street_sign','street sign','signs','street sign issue') then return 'street_signs'::public.incident_domain; end if;
  if d in ('potholes','pothole') then return 'potholes'::public.incident_domain; end if;
  if d in ('water_drain_issues','water drain issues','drain_issues','drain issues','storm drain','storm_drain','sewer','sewer backup') then return 'water_drain_issues'::public.incident_domain; end if;
  if d in ('power_outage','power outage','power','outage') then return 'power_outage'::public.incident_domain; end if;
  if d in ('water_main','water main','water main break','water_main_break') then return 'water_main'::public.incident_domain; end if;

  if t in ('sewer_backup','storm_drain_clog') then return 'water_drain_issues'::public.incident_domain; end if;
  if t like '%sewer%' or t like '%storm_drain%' or t like '%drain%' then return 'water_drain_issues'::public.incident_domain; end if;
  if t like '%sign%' then return 'street_signs'::public.incident_domain; end if;
  if t like '%pothole%' then return 'potholes'::public.incident_domain; end if;
  if t like '%water main%' then return 'water_main'::public.incident_domain; end if;
  if t like '%power%' then return 'power_outage'::public.incident_domain; end if;

  return 'streetlights'::public.incident_domain;
end;
$$;

-- 4) Visibility + export contract alignment (Model C).
insert into public.tenant_visibility_config (tenant_key, domain, visibility)
values
  ('default', 'streetlights'::public.incident_domain, 'internal_only'),
  ('default', 'potholes'::public.incident_domain, 'public'),
  ('default', 'water_drain_issues'::public.incident_domain, 'public'),
  ('default', 'power_outage'::public.incident_domain, 'internal_only'),
  ('default', 'water_main'::public.incident_domain, 'internal_only')
on conflict (tenant_key, domain)
do update set
  visibility = excluded.visibility,
  updated_at = now();

create or replace view public.export_incident_detail_v1 as
with metrics as (
  select * from public.incident_timeline_metrics_v1
),
general_reports as (
  select
    r.id as report_id,
    r.report_number,
    public.map_incident_domain_from_report(
      r.light_id,
      null::text,
      coalesce(r.report_type, '')
    ) as domain,
    r.light_id as incident_id,
    r.created_at as submitted_at,
    r.note as notes,
    r.reporter_name,
    r.reporter_email,
    r.reporter_phone,
    r.reporter_user_id,
    r.report_source
  from public.reports r
  where coalesce(lower(r.report_quality), 'bad') = 'bad'
),
potholes as (
  select
    p.id as report_id,
    p.report_number,
    'potholes'::public.incident_domain as domain,
    ('pothole:' || p.pothole_id)::text as incident_id,
    p.created_at as submitted_at,
    p.note as notes,
    p.reporter_name,
    p.reporter_email,
    p.reporter_phone,
    p.reporter_user_id,
    p.report_source
  from public.pothole_reports p
),
all_rows as (
  select *
  from general_reports
  where domain in (
    'streetlights'::public.incident_domain,
    'street_signs'::public.incident_domain,
    'water_drain_issues'::public.incident_domain,
    'power_outage'::public.incident_domain,
    'water_main'::public.incident_domain
  )
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
  a.report_source as source,
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
  on m.domain = a.domain
 and m.incident_id = a.incident_id;

create or replace view public.internal_metrics_report_source_breakdown_v1 as
select
  d.domain,
  coalesce(d.source, 'citizen') as report_source,
  count(*)::bigint as report_count,
  min(d.submitted_at) as first_reported_at,
  max(d.submitted_at) as last_reported_at
from public.export_incident_detail_v1 d
group by d.domain, coalesce(d.source, 'citizen')
order by d.domain, coalesce(d.source, 'citizen');

revoke all on public.internal_metrics_report_source_breakdown_v1 from public;
grant select on public.internal_metrics_report_source_breakdown_v1 to authenticated;

commit;

-- Week 1 - Municipal export readiness query templates
-- Purpose:
-- 1) Summary export (one row per incident)
-- 2) Detail export (one row per submitted report)
--
-- Date filter placeholders:
--   :from_ts  -> inclusive timestamptz (example: '2026-03-01 00:00:00+00')
--   :to_ts    -> exclusive timestamptz (example: '2026-04-01 00:00:00+00')
--
-- If your SQL editor does not support bind params, replace directly.

-- ============================================================
-- A) Detail export (streetlights + potholes)
-- Contract fields:
-- - report_id
-- - report_number
-- - domain
-- - incident_id
-- - submitted_at
-- - fixed_at
-- - time_to_close_seconds
-- - current_state
-- - reporter_name / reporter_email / reporter_phone
-- - notes
-- ============================================================
with fixed_events as (
  select
    domain,
    incident_id,
    min(changed_at) as first_fixed_at
  from public.incident_events
  where new_state = 'fixed'::public.incident_state
  group by domain, incident_id
),
streetlight_rows as (
  select
    r.id::text as report_id,
    coalesce(r.report_number, ('SLR' || lpad(r.id::text, 7, '0'))) as report_number,
    'streetlights'::text as domain,
    r.light_id::text as incident_id,
    r.created_at as submitted_at,
    fx.first_fixed_at as fixed_at,
    case
      when fx.first_fixed_at is not null
      then extract(epoch from (fx.first_fixed_at - r.created_at))::bigint
      else null
    end as time_to_close_seconds,
    isc.state::text as current_state,
    r.reporter_name,
    r.reporter_email,
    r.reporter_phone,
    r.note as notes
  from public.reports r
  left join fixed_events fx
    on fx.domain = 'streetlights'::public.incident_domain
   and fx.incident_id = r.light_id
  left join public.incident_state_current isc
    on isc.domain = 'streetlights'::public.incident_domain
   and isc.incident_id = r.light_id
  where r.created_at >= :from_ts
    and r.created_at < :to_ts
    and coalesce(lower(r.report_quality), 'bad') = 'bad'
),
pothole_rows as (
  select
    pr.id::text as report_id,
    coalesce(pr.report_number, ('PHR' || lpad(pr.id::text, 7, '0'))) as report_number,
    'potholes'::text as domain,
    ('pothole:' || pr.pothole_id::text) as incident_id,
    pr.created_at as submitted_at,
    fx.first_fixed_at as fixed_at,
    case
      when fx.first_fixed_at is not null
      then extract(epoch from (fx.first_fixed_at - pr.created_at))::bigint
      else null
    end as time_to_close_seconds,
    isc.state::text as current_state,
    pr.reporter_name,
    pr.reporter_email,
    pr.reporter_phone,
    pr.note as notes
  from public.pothole_reports pr
  left join fixed_events fx
    on fx.domain = 'potholes'::public.incident_domain
   and fx.incident_id = ('pothole:' || pr.pothole_id::text)
  left join public.incident_state_current isc
    on isc.domain = 'potholes'::public.incident_domain
   and isc.incident_id = ('pothole:' || pr.pothole_id::text)
  where pr.created_at >= :from_ts
    and pr.created_at < :to_ts
)
select *
from (
  select * from streetlight_rows
  union all
  select * from pothole_rows
) x
order by submitted_at desc, domain, incident_id;


-- ============================================================
-- B) Summary export (one row per incident)
-- Contract fields:
-- - domain
-- - incident_id
-- - first_reported_at
-- - latest_reported_at
-- - fixed_at (first fixed event after first report window)
-- - time_to_close_seconds (first fix - first report)
-- - current_state
-- - report_count
-- ============================================================
with detail as (
  -- Reuse logic from section A without extra contact fields.
  with fixed_events as (
    select domain, incident_id, min(changed_at) as first_fixed_at
    from public.incident_events
    where new_state = 'fixed'::public.incident_state
    group by domain, incident_id
  ),
  streetlight_rows as (
    select
      'streetlights'::text as domain,
      r.light_id::text as incident_id,
      r.created_at as submitted_at,
      fx.first_fixed_at as fixed_at,
      isc.state::text as current_state
    from public.reports r
    left join fixed_events fx
      on fx.domain = 'streetlights'::public.incident_domain
     and fx.incident_id = r.light_id
    left join public.incident_state_current isc
      on isc.domain = 'streetlights'::public.incident_domain
     and isc.incident_id = r.light_id
    where r.created_at >= :from_ts
      and r.created_at < :to_ts
      and coalesce(lower(r.report_quality), 'bad') = 'bad'
  ),
  pothole_rows as (
    select
      'potholes'::text as domain,
      ('pothole:' || pr.pothole_id::text) as incident_id,
      pr.created_at as submitted_at,
      fx.first_fixed_at as fixed_at,
      isc.state::text as current_state
    from public.pothole_reports pr
    left join fixed_events fx
      on fx.domain = 'potholes'::public.incident_domain
     and fx.incident_id = ('pothole:' || pr.pothole_id::text)
    left join public.incident_state_current isc
      on isc.domain = 'potholes'::public.incident_domain
     and isc.incident_id = ('pothole:' || pr.pothole_id::text)
    where pr.created_at >= :from_ts
      and pr.created_at < :to_ts
  )
  select * from streetlight_rows
  union all
  select * from pothole_rows
)
select
  d.domain,
  d.incident_id,
  min(d.submitted_at) as first_reported_at,
  max(d.submitted_at) as latest_reported_at,
  min(d.fixed_at) as fixed_at,
  case
    when min(d.fixed_at) is not null
    then extract(epoch from (min(d.fixed_at) - min(d.submitted_at)))::bigint
    else null
  end as time_to_close_seconds,
  max(d.current_state) as current_state,
  count(*)::int as report_count
from detail d
group by d.domain, d.incident_id
order by latest_reported_at desc, d.domain, d.incident_id;

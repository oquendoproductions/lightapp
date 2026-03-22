-- CityReport Week 2: Export + Metrics Foundation
-- Depends on Week 1 lifecycle objects.
-- Safe to run multiple times.

begin;

-- 1) Export audit log
create table if not exists public.export_audit_log (
  id bigserial primary key,
  exported_by uuid,
  exported_at timestamptz not null default now(),
  export_kind text not null, -- summary | detail
  domain public.incident_domain,
  state public.incident_state,
  from_date date,
  to_date date,
  incident_id text,
  filters jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  check (export_kind in ('summary', 'detail')),
  check (row_count >= 0)
);

create index if not exists export_audit_log_exported_at_idx
  on public.export_audit_log (exported_at desc);

create index if not exists export_audit_log_exported_by_idx
  on public.export_audit_log (exported_by, exported_at desc);

-- 2) Canonical open/closed helper view
create or replace view public.incident_status_flags as
select
  s.domain,
  s.incident_id,
  s.state as current_state,
  s.last_changed_at,
  s.reopen_count,
  case
    when s.state in ('fixed', 'archived') then false
    else true
  end as is_open
from public.incident_state_current s;

-- 3) First reported + first fixed timestamps for metrics
create or replace view public.incident_first_last_timestamps as
with e as (
  select
    domain,
    incident_id,
    min(changed_at) filter (where new_state = 'reported') as first_reported_at,
    min(changed_at) filter (where new_state = 'fixed') as first_fixed_at,
    max(changed_at) as last_event_at
  from public.incident_events
  group by domain, incident_id
)
select * from e;

-- 4) Municipal summary export view
create or replace view public.export_incident_summary_v1 as
select
  f.domain,
  f.incident_id,
  f.current_state,
  f.last_changed_at,
  f.reopen_count,
  f.is_open
from public.incident_status_flags f;

-- 5) Streetlight detail export view
create or replace view public.export_streetlight_detail_v1 as
with incident_base as (
  select
    s.domain,
    s.incident_id,
    s.current_state,
    s.last_changed_at,
    t.first_reported_at,
    t.first_fixed_at
  from public.incident_status_flags s
  left join public.incident_first_last_timestamps t
    on t.domain = s.domain
   and t.incident_id = s.incident_id
  where s.domain = 'streetlights'
),
reports_src as (
  select
    r.id as source_report_id,
    r.report_number,
    'streetlights'::public.incident_domain as domain,
    r.light_id as incident_id,
    r.created_at as submission_timestamp,
    r.report_type,
    r.report_quality,
    r.reporter_name,
    r.reporter_email,
    r.reporter_phone,
    r.note,
    r.reporter_user_id
  from public.reports r
  where coalesce(lower(r.report_quality), 'bad') = 'bad'
)
select
  rs.source_report_id,
  rs.report_number,
  rs.domain,
  rs.incident_id,
  rs.submission_timestamp,
  ib.first_fixed_at as fix_timestamp,
  case
    when ib.first_fixed_at is null then null
    else extract(epoch from (ib.first_fixed_at - ib.first_reported_at))::bigint
  end as time_to_close_seconds,
  ib.current_state,
  rs.reporter_name,
  rs.reporter_email,
  rs.reporter_phone,
  rs.note,
  'user'::text as source
from reports_src rs
left join incident_base ib
  on ib.domain = rs.domain
 and ib.incident_id = rs.incident_id;

-- 6) Pothole detail export view
create or replace view public.export_pothole_detail_v1 as
with incident_base as (
  select
    s.domain,
    s.incident_id,
    s.current_state,
    s.last_changed_at,
    t.first_reported_at,
    t.first_fixed_at
  from public.incident_status_flags s
  left join public.incident_first_last_timestamps t
    on t.domain = s.domain
   and t.incident_id = s.incident_id
  where s.domain = 'potholes'
),
reports_src as (
  select
    p.id as source_report_id,
    p.report_number,
    'potholes'::public.incident_domain as domain,
    ('pothole:' || p.pothole_id)::text as incident_id,
    p.created_at as submission_timestamp,
    p.reporter_name,
    p.reporter_email,
    p.reporter_phone,
    p.note
  from public.pothole_reports p
)
select
  rs.source_report_id,
  rs.report_number,
  rs.domain,
  rs.incident_id,
  rs.submission_timestamp,
  ib.first_fixed_at as fix_timestamp,
  case
    when ib.first_fixed_at is null then null
    else extract(epoch from (ib.first_fixed_at - ib.first_reported_at))::bigint
  end as time_to_close_seconds,
  ib.current_state,
  rs.reporter_name,
  rs.reporter_email,
  rs.reporter_phone,
  rs.note,
  'user'::text as source
from reports_src rs
left join incident_base ib
  on ib.domain = rs.domain
 and ib.incident_id = rs.incident_id;

-- 7) Unified detail export view
create or replace view public.export_incident_detail_v1 as
select * from public.export_streetlight_detail_v1
union all
select * from public.export_pothole_detail_v1;

-- 8) KPI view: incident state counts
create or replace view public.metrics_incident_state_counts_v1 as
select
  domain,
  current_state,
  count(*) as incident_count
from public.incident_status_flags
group by domain, current_state
order by domain, current_state;

-- 9) KPI view: close-time stats
create or replace view public.metrics_time_to_close_v1 as
with closed_incidents as (
  select
    t.domain,
    t.incident_id,
    extract(epoch from (t.first_fixed_at - t.first_reported_at))::bigint as time_to_close_seconds
  from public.incident_first_last_timestamps t
  where t.first_reported_at is not null
    and t.first_fixed_at is not null
    and t.first_fixed_at >= t.first_reported_at
)
select
  domain,
  count(*) as closed_incident_count,
  avg(time_to_close_seconds)::bigint as avg_time_to_close_seconds,
  percentile_cont(0.5) within group (order by time_to_close_seconds)::bigint as p50_time_to_close_seconds,
  percentile_cont(0.9) within group (order by time_to_close_seconds)::bigint as p90_time_to_close_seconds
from closed_incidents
group by domain
order by domain;

-- 10) KPI view: top recurring incidents
create or replace view public.metrics_top_recurring_incidents_v1 as
select
  domain,
  incident_id,
  reopen_count,
  last_changed_at
from public.incident_status_flags
where reopen_count > 0
order by reopen_count desc, last_changed_at desc;

-- 11) Export audit helper RPC
create or replace function public.log_export_action(
  p_export_kind text,
  p_domain public.incident_domain default null,
  p_state public.incident_state default null,
  p_from_date date default null,
  p_to_date date default null,
  p_incident_id text default null,
  p_filters jsonb default '{}'::jsonb,
  p_row_count integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.export_audit_log (
    exported_by,
    export_kind,
    domain,
    state,
    from_date,
    to_date,
    incident_id,
    filters,
    row_count
  )
  values (
    auth.uid(),
    p_export_kind,
    p_domain,
    p_state,
    p_from_date,
    p_to_date,
    p_incident_id,
    coalesce(p_filters, '{}'::jsonb),
    coalesce(p_row_count, 0)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.log_export_action(
  text,
  public.incident_domain,
  public.incident_state,
  date,
  date,
  text,
  jsonb,
  integer
) to authenticated;

-- 12) RLS for export audit
alter table public.export_audit_log enable row level security;

drop policy if exists export_audit_select_admin on public.export_audit_log;
create policy export_audit_select_admin
on public.export_audit_log
for select
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists export_audit_insert_admin on public.export_audit_log;
create policy export_audit_insert_admin
on public.export_audit_log
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

commit;

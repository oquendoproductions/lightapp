-- Week 1 Evidence Query Pack
-- Run in Supabase SQL editor (read-only)

-- A) Recent incident events
select
  domain,
  incident_id,
  previous_state,
  new_state,
  source,
  changed_by,
  changed_at,
  metadata
from public.incident_events
order by changed_at desc
limit 100;

-- B) Current snapshot health by domain/state
select
  domain,
  state,
  count(*) as incident_count,
  max(last_changed_at) as latest_change
from public.incident_state_current
group by domain, state
order by domain, state;

-- C) Reopen count leaderboard
select
  domain,
  incident_id,
  reopen_count,
  last_changed_at
from public.incident_state_current
where reopen_count > 0
order by reopen_count desc, last_changed_at desc
limit 50;

-- D) Timeline for one incident (set values)
-- replace :domain and :incident_id manually in SQL editor
-- example:
--   domain = 'streetlights'
--   incident_id = 'SL1234567890'
select
  id,
  previous_state,
  new_state,
  source,
  changed_by,
  changed_at,
  metadata
from public.incident_events
where domain = 'streetlights'::public.incident_domain
  and incident_id = 'SL1234567890'
order by changed_at asc, id asc;

-- E) Time-to-close sample (fixed incidents only)
with first_reported as (
  select
    domain,
    incident_id,
    min(changed_at) as reported_at
  from public.incident_events
  where new_state = 'reported'::public.incident_state
  group by domain, incident_id
),
first_fixed as (
  select
    domain,
    incident_id,
    min(changed_at) as fixed_at
  from public.incident_events
  where new_state = 'fixed'::public.incident_state
  group by domain, incident_id
)
select
  r.domain,
  r.incident_id,
  r.reported_at,
  f.fixed_at,
  extract(epoch from (f.fixed_at - r.reported_at))::bigint as time_to_close_seconds
from first_reported r
join first_fixed f
  on f.domain = r.domain
 and f.incident_id = r.incident_id
where f.fixed_at >= r.reported_at
order by f.fixed_at desc
limit 100;

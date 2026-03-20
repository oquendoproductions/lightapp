-- Cleanup historical pre-guard lifecycle rows that violated transition rules.
-- Scope is intentionally limited to rows created before the lifecycle-guard migration.

begin;

-- 1) Ensure quarantine table exists so historical rows are preserved.
create table if not exists public.incident_events_quarantine (
  like public.incident_events including all,
  quarantined_at timestamptz not null default now(),
  quarantine_reason text not null
);

-- 2) Capture target invalid rows (pre-guard window, known invalid shapes).
with target as (
  select *
  from public.incident_events
  where changed_at < '2026-03-01 23:30:00+00'::timestamptz
    and (
      (previous_state = 'reported'::public.incident_state and new_state = 'fixed'::public.incident_state)
      or
      (previous_state = 'reopened'::public.incident_state and new_state = 'fixed'::public.incident_state)
    )
)
insert into public.incident_events_quarantine (
  id, domain, incident_id, previous_state, new_state,
  source, changed_by, metadata, changed_at, quarantine_reason
)
select
  t.id, t.domain, t.incident_id, t.previous_state, t.new_state,
  t.source, t.changed_by, t.metadata, t.changed_at,
  'pre_guard_invalid_transition_normalization'
from target t
on conflict (id) do nothing;

-- 3) Insert inferred transition rows for continuity:
--    reported -> confirmed, reopened -> confirmed
insert into public.incident_events (
  domain,
  incident_id,
  previous_state,
  new_state,
  source,
  changed_by,
  metadata,
  changed_at
)
select
  e.domain,
  e.incident_id,
  e.previous_state,
  'confirmed'::public.incident_state,
  'system',
  e.changed_by,
  coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
    'inferred', true,
    'inferred_by', '20260302000500_cleanup_pre_guard_invalid_incident_events',
    'inferred_from_event_id', e.id,
    'inferred_path', concat(e.previous_state::text, '->confirmed')
  ),
  e.changed_at - interval '1 millisecond'
from public.incident_events e
where e.changed_at < '2026-03-01 23:30:00+00'::timestamptz
  and e.new_state = 'fixed'::public.incident_state
  and e.previous_state in ('reported'::public.incident_state, 'reopened'::public.incident_state)
  and not exists (
    select 1
    from public.incident_events x
    where x.domain = e.domain
      and x.incident_id = e.incident_id
      and x.previous_state = e.previous_state
      and x.new_state = 'confirmed'::public.incident_state
      and abs(extract(epoch from (x.changed_at - (e.changed_at - interval '1 millisecond')))) < 0.0005
  );

-- 4) Normalize the invalid fixed rows to confirmed -> fixed.
update public.incident_events e
set
  previous_state = 'confirmed'::public.incident_state,
  source = 'system',
  metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
    'normalized', true,
    'normalized_by', '20260302000500_cleanup_pre_guard_invalid_incident_events',
    'normalized_from_previous_state', e.previous_state::text
  )
where e.changed_at < '2026-03-01 23:30:00+00'::timestamptz
  and e.new_state = 'fixed'::public.incident_state
  and e.previous_state in ('reported'::public.incident_state, 'reopened'::public.incident_state);

-- 5) Rebuild current-state snapshot from the normalized event stream.
truncate table public.incident_state_current;

insert into public.incident_state_current (domain, incident_id, state, last_changed_at)
select distinct on (e.domain, e.incident_id)
  e.domain,
  e.incident_id,
  e.new_state,
  e.changed_at
from public.incident_events e
order by e.domain, e.incident_id, e.changed_at desc, e.id desc;

commit;

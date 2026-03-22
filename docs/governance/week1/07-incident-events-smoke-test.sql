-- CityReport Week 1: Smoke tests for incident lifecycle event logging
-- Run after 04 + 06 migrations.

begin;

-- 0) Verify core objects exist
select 'incident_events_exists' as check_name,
       exists(select 1 from information_schema.tables where table_schema='public' and table_name='incident_events') as ok;

select 'incident_state_current_exists' as check_name,
       exists(select 1 from information_schema.tables where table_schema='public' and table_name='incident_state_current') as ok;

-- 1) Manual transition smoke (synthetic incident)
select public.emit_incident_state_change(
  p_incident_id := 'smoke:streetlight:001',
  p_domain := 'streetlights',
  p_new_state := 'reported',
  p_changed_by := null,
  p_source := 'system',
  p_metadata := jsonb_build_object('test','smoke_reported')
);

select public.emit_incident_state_change(
  p_incident_id := 'smoke:streetlight:001',
  p_domain := 'streetlights',
  p_new_state := 'aggregated',
  p_changed_by := null,
  p_source := 'system',
  p_metadata := jsonb_build_object('test','smoke_aggregated')
);

select public.emit_incident_state_change(
  p_incident_id := 'smoke:streetlight:001',
  p_domain := 'streetlights',
  p_new_state := 'fixed',
  p_changed_by := null,
  p_source := 'admin',
  p_metadata := jsonb_build_object('test','smoke_fixed')
);

select public.emit_incident_state_change(
  p_incident_id := 'smoke:streetlight:001',
  p_domain := 'streetlights',
  p_new_state := 'reopened',
  p_changed_by := null,
  p_source := 'user',
  p_metadata := jsonb_build_object('test','smoke_reopened')
);

-- 2) Validate timeline
select domain, incident_id, previous_state, new_state, source, changed_at, metadata
from public.incident_events
where incident_id = 'smoke:streetlight:001'
order by changed_at asc, id asc;

-- 3) Validate snapshot reflects latest state and reopen count
select domain, incident_id, state, reopen_count, last_changed_at
from public.incident_state_current
where incident_id = 'smoke:streetlight:001';

-- 4) Validate transition function
select
  public.is_valid_incident_transition(null, 'reported') as ok_initial,
  public.is_valid_incident_transition('reported', 'aggregated') as ok_reported_to_agg,
  public.is_valid_incident_transition('fixed', 'reopened') as ok_fixed_to_reopen,
  public.is_valid_incident_transition('reported', 'fixed') as bad_reported_to_fixed_should_be_false;

-- 5) Optional cleanup for repeated smoke runs
-- delete from public.incident_events where incident_id = 'smoke:streetlight:001';
-- delete from public.incident_state_current where incident_id = 'smoke:streetlight:001';

rollback;

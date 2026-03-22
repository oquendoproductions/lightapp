-- CityReport Week 1: rollback for incident lifecycle event logging
-- Use only if you need to fully revert this feature set.

begin;

drop trigger if exists trg_incident_events_apply_snapshot on public.incident_events;
drop function if exists public.apply_incident_event_to_snapshot();
drop function if exists public.is_valid_incident_transition(public.incident_state, public.incident_state);

drop table if exists public.incident_state_current;
drop table if exists public.incident_events;

drop type if exists public.incident_event_source;
drop type if exists public.incident_state;
drop type if exists public.incident_domain;

commit;

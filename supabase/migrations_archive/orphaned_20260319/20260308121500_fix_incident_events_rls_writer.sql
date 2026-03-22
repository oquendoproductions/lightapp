-- Fix lifecycle event writes under incident_events RLS.
-- Trigger path writes incident_events through emit_incident_state_change.

begin;

alter function public.emit_incident_state_change(
  text,
  public.incident_domain,
  public.incident_state,
  uuid,
  public.incident_event_source,
  jsonb,
  timestamptz,
  boolean
)
security definer
set search_path = public, pg_temp;

commit;

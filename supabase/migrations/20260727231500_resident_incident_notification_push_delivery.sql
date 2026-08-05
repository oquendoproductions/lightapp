-- Tracks native push delivery for private reporter status updates.

begin;

alter table public.resident_incident_notifications
  add column if not exists push_sent_at timestamptz;

commit;

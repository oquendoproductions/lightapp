-- Private, in-app lifecycle updates for residents who submitted a report.
-- This intentionally does not deliver email or push notifications.

begin;

create table if not exists public.resident_incident_notifications (
  id bigserial primary key,
  tenant_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  incident_event_id bigint not null references public.incident_events(id) on delete cascade,
  incident_id text not null,
  domain text not null,
  previous_state text,
  new_state text not null,
  title text not null,
  summary text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, incident_event_id)
);

create index if not exists resident_incident_notifications_user_created_idx
  on public.resident_incident_notifications (user_id, created_at desc);

alter table public.resident_incident_notifications enable row level security;

drop policy if exists resident_incident_notifications_select_self on public.resident_incident_notifications;
create policy resident_incident_notifications_select_self
on public.resident_incident_notifications
for select to authenticated
using (user_id = auth.uid());

drop policy if exists resident_incident_notifications_update_self on public.resident_incident_notifications;
create policy resident_incident_notifications_update_self
on public.resident_incident_notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.create_resident_incident_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant text := lower(trim(coalesce(new.tenant_key, public.request_tenant_key(), '')));
  v_previous text := coalesce(new.previous_state::text, 'reported');
  v_next text := coalesce(new.new_state::text, 'reported');
  v_title text;
  v_summary text;
begin
  -- A resident's original report is not an update. Later lifecycle changes,
  -- including another resident's confirming report, notify prior reporters.
  if new.previous_state is null or new.previous_state = new.new_state then
    return new;
  end if;

  if v_tenant = '' then
    return new;
  end if;

  v_title := case
    when v_next = 'fixed' then 'Your reported issue was marked fixed'
    else 'Your reported issue status changed'
  end;
  v_summary := format('Incident %s changed from %s to %s.', new.incident_id, replace(v_previous, '_', ' '), replace(v_next, '_', ' '));

  insert into public.resident_incident_notifications (
    tenant_key, user_id, incident_event_id, incident_id, domain,
    previous_state, new_state, title, summary, created_at
  )
  select distinct
    v_tenant,
    prior.changed_by,
    new.id,
    new.incident_id,
    new.domain::text,
    v_previous,
    v_next,
    v_title,
    v_summary,
    new.changed_at
  from public.incident_events prior
  where prior.tenant_key = v_tenant
    and prior.domain = new.domain
    and prior.incident_id = new.incident_id
    and prior.source = 'user'
    and prior.changed_by is not null
    and prior.changed_by is distinct from new.changed_by
  on conflict (user_id, incident_event_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_resident_incident_status_notifications on public.incident_events;
create trigger trg_resident_incident_status_notifications
after insert on public.incident_events
for each row execute function public.create_resident_incident_status_notifications();

commit;

-- CityReport Week 1: Lifecycle Event Log Schema (Draft)

begin;

-- 1) Incident domain enum
create type if not exists public.incident_domain as enum (
  'streetlights',
  'potholes',
  'power_outage',
  'water_main'
);

-- 2) Incident state enum
create type if not exists public.incident_state as enum (
  'reported',
  'aggregated',
  'confirmed',
  'in_progress',
  'fixed',
  'reopened',
  'archived'
);

-- 3) Event source enum
create type if not exists public.incident_event_source as enum (
  'system',
  'admin',
  'user'
);

-- 4) Incident events table (append-only)
create table if not exists public.incident_events (
  id bigserial primary key,
  incident_id text not null,
  domain public.incident_domain not null,
  previous_state public.incident_state,
  new_state public.incident_state not null,
  changed_by uuid,
  source public.incident_event_source not null,
  changed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists incident_events_incident_idx
  on public.incident_events (domain, incident_id, changed_at desc);

create index if not exists incident_events_state_idx
  on public.incident_events (domain, new_state, changed_at desc);

-- 5) Optional current snapshot table (fast read model)
create table if not exists public.incident_state_current (
  incident_id text not null,
  domain public.incident_domain not null,
  state public.incident_state not null,
  last_changed_at timestamptz not null,
  reopen_count integer not null default 0,
  primary key (domain, incident_id)
);

-- 6) Trigger function for snapshot update
create or replace function public.apply_incident_event_to_snapshot()
returns trigger
language plpgsql
as $$
declare
  prior_reopen_count integer;
begin
  if new.new_state = 'reopened' then
    select coalesce(reopen_count, 0)
      into prior_reopen_count
      from public.incident_state_current
      where domain = new.domain and incident_id = new.incident_id;

    insert into public.incident_state_current (domain, incident_id, state, last_changed_at, reopen_count)
    values (new.domain, new.incident_id, new.new_state, new.changed_at, coalesce(prior_reopen_count, 0) + 1)
    on conflict (domain, incident_id)
    do update set
      state = excluded.state,
      last_changed_at = excluded.last_changed_at,
      reopen_count = excluded.reopen_count;
  else
    insert into public.incident_state_current (domain, incident_id, state, last_changed_at)
    values (new.domain, new.incident_id, new.new_state, new.changed_at)
    on conflict (domain, incident_id)
    do update set
      state = excluded.state,
      last_changed_at = excluded.last_changed_at;
  end if;

  return new;
end;
$$;

-- 7) Trigger
 drop trigger if exists trg_incident_events_apply_snapshot on public.incident_events;
 create trigger trg_incident_events_apply_snapshot
 after insert on public.incident_events
 for each row execute function public.apply_incident_event_to_snapshot();

commit;

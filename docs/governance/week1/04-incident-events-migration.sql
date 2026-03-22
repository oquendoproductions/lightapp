-- CityReport Week 1: Incident lifecycle event logging migration (idempotent)
-- Safe to run multiple times.

begin;

-- 1) Enums (create once)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'incident_domain') then
    create type public.incident_domain as enum (
      'streetlights',
      'potholes',
      'power_outage',
      'water_main'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'incident_state') then
    create type public.incident_state as enum (
      'reported',
      'aggregated',
      'confirmed',
      'in_progress',
      'fixed',
      'reopened',
      'archived'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'incident_event_source') then
    create type public.incident_event_source as enum (
      'system',
      'admin',
      'user'
    );
  end if;
end
$$;

-- 2) Append-only event log
create table if not exists public.incident_events (
  id bigserial primary key,
  incident_id text not null,
  domain public.incident_domain not null,
  previous_state public.incident_state,
  new_state public.incident_state not null,
  changed_by uuid,
  source public.incident_event_source not null,
  changed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (length(trim(incident_id)) > 0)
);

create index if not exists incident_events_incident_idx
  on public.incident_events (domain, incident_id, changed_at desc);

create index if not exists incident_events_state_idx
  on public.incident_events (domain, new_state, changed_at desc);

create index if not exists incident_events_changed_by_idx
  on public.incident_events (changed_by, changed_at desc);

-- 3) Current-state read model
create table if not exists public.incident_state_current (
  incident_id text not null,
  domain public.incident_domain not null,
  state public.incident_state not null,
  last_changed_at timestamptz not null,
  reopen_count integer not null default 0,
  primary key (domain, incident_id),
  check (length(trim(incident_id)) > 0),
  check (reopen_count >= 0)
);

create index if not exists incident_state_current_state_idx
  on public.incident_state_current (domain, state, last_changed_at desc);

-- 4) Trigger function: apply each event to snapshot
create or replace function public.apply_incident_event_to_snapshot()
returns trigger
language plpgsql
as $$
begin
  insert into public.incident_state_current (
    domain,
    incident_id,
    state,
    last_changed_at,
    reopen_count
  )
  values (
    new.domain,
    new.incident_id,
    new.new_state,
    new.changed_at,
    case when new.new_state = 'reopened' then 1 else 0 end
  )
  on conflict (domain, incident_id)
  do update set
    state = excluded.state,
    last_changed_at = excluded.last_changed_at,
    reopen_count = case
      when excluded.state = 'reopened'
        then public.incident_state_current.reopen_count + 1
      else public.incident_state_current.reopen_count
    end;

  return new;
end;
$$;

-- 5) Trigger (recreate safely)
drop trigger if exists trg_incident_events_apply_snapshot on public.incident_events;

create trigger trg_incident_events_apply_snapshot
after insert on public.incident_events
for each row
execute function public.apply_incident_event_to_snapshot();

-- 6) Optional transition guard function (call this from app/service when writing events)
create or replace function public.is_valid_incident_transition(
  prev_state public.incident_state,
  next_state public.incident_state
)
returns boolean
language sql
immutable
as $$
  select case
    when prev_state is null and next_state = 'reported' then true
    when prev_state = 'reported' and next_state in ('aggregated', 'confirmed') then true
    when prev_state = 'aggregated' and next_state = 'confirmed' then true
    when prev_state = 'confirmed' and next_state in ('in_progress', 'fixed') then true
    when prev_state = 'in_progress' and next_state = 'fixed' then true
    when prev_state = 'fixed' and next_state in ('reopened', 'archived') then true
    when prev_state = 'reopened' and next_state in ('confirmed', 'archived') then true
    else false
  end;
$$;

commit;

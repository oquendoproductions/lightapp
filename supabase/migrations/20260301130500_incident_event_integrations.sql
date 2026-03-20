-- CityReport Week 1: Integrate existing write paths with incident_events
-- Run AFTER 04-incident-events-migration.sql
-- This script is defensive and only wires triggers when expected tables/columns exist.

begin;

-- 1) Helpers
create or replace function public.map_incident_domain_from_light_id(p_light_id text)
returns public.incident_domain
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_light_id, '')));
begin
  if v like 'potholes:%' or v like 'pothole:%' then
    return 'potholes'::public.incident_domain;
  elsif v like 'power_outage:%' then
    return 'power_outage'::public.incident_domain;
  elsif v like 'water_main:%' then
    return 'water_main'::public.incident_domain;
  else
    return 'streetlights'::public.incident_domain;
  end if;
end;
$$;

create or replace function public.map_incident_domain_from_report(
  p_light_id text,
  p_report_domain text,
  p_report_type text
)
returns public.incident_domain
language plpgsql
immutable
as $$
declare
  lid text := lower(trim(coalesce(p_light_id, '')));
  d text := lower(trim(coalesce(p_report_domain, '')));
  t text := lower(trim(coalesce(p_report_type, '')));
begin
  if lid like 'potholes:%' then return 'potholes'::public.incident_domain; end if;
  if lid like 'power_outage:%' then return 'power_outage'::public.incident_domain; end if;
  if lid like 'water_main:%' then return 'water_main'::public.incident_domain; end if;

  if d in ('streetlights','streetlight') then return 'streetlights'::public.incident_domain; end if;
  if d in ('potholes','pothole') then return 'potholes'::public.incident_domain; end if;
  if d in ('power_outage','power outage','power','outage') then return 'power_outage'::public.incident_domain; end if;
  if d in ('water_main','water main','water main break','water_main_break') then return 'water_main'::public.incident_domain; end if;

  if t like '%pothole%' then return 'potholes'::public.incident_domain; end if;
  if t like '%water%' then return 'water_main'::public.incident_domain; end if;
  if t like '%power%' then return 'power_outage'::public.incident_domain; end if;

  return 'streetlights'::public.incident_domain;
end;
$$;

create or replace function public.emit_incident_state_change(
  p_incident_id text,
  p_domain public.incident_domain,
  p_new_state public.incident_state,
  p_changed_by uuid,
  p_source public.incident_event_source,
  p_metadata jsonb default '{}'::jsonb,
  p_changed_at timestamptz default now(),
  p_force boolean default false
)
returns void
language plpgsql
as $$
declare
  v_prev public.incident_state;
begin
  if p_incident_id is null or length(trim(p_incident_id)) = 0 then
    return;
  end if;

  select state into v_prev
  from public.incident_state_current
  where domain = p_domain and incident_id = trim(p_incident_id);

  if not p_force and v_prev = p_new_state then
    return;
  end if;

  insert into public.incident_events (
    incident_id,
    domain,
    previous_state,
    new_state,
    changed_by,
    source,
    changed_at,
    metadata
  ) values (
    trim(p_incident_id),
    p_domain,
    v_prev,
    p_new_state,
    p_changed_by,
    p_source,
    coalesce(p_changed_at, now()),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- 2) reports -> reported/aggregated/reopened (for non-working reports)
create or replace function public.trg_reports_to_incident_events()
returns trigger
language plpgsql
as $$
declare
  v_type text := lower(trim(coalesce(new.report_type, new.type, '')));
  v_quality text := lower(trim(coalesce(new.report_quality, '')));
  v_domain public.incident_domain;
  v_incident_id text;
  v_current public.incident_state;
  v_next public.incident_state;
  v_ts timestamptz := coalesce(new.created_at, now());
begin
  -- Ignore "working/good" reports for outage lifecycle transitions
  if v_quality = 'good' or v_type in ('working','reported_working','is_working') then
    return new;
  end if;

  v_domain := public.map_incident_domain_from_report(new.light_id, new.report_domain, coalesce(new.report_type, new.type));
  v_incident_id := trim(coalesce(new.light_id, ''));
  if v_incident_id = '' then
    return new;
  end if;

  select state into v_current
  from public.incident_state_current
  where domain = v_domain and incident_id = v_incident_id;

  if v_current is null then
    v_next := 'reported'::public.incident_state;
  elsif v_current in ('fixed','archived') then
    v_next := 'reopened'::public.incident_state;
  elsif v_current in ('reported','aggregated','confirmed','in_progress','reopened') then
    v_next := 'aggregated'::public.incident_state;
  else
    v_next := 'aggregated'::public.incident_state;
  end if;

  perform public.emit_incident_state_change(
    v_incident_id,
    v_domain,
    v_next,
    new.reporter_user_id,
    'user'::public.incident_event_source,
    jsonb_build_object('source_table','reports','report_id',new.id,'report_type',coalesce(new.report_type, new.type)),
    v_ts,
    false
  );

  return new;
end;
$$;

-- 3) pothole_reports -> reported/aggregated/reopened
create or replace function public.trg_pothole_reports_to_incident_events()
returns trigger
language plpgsql
as $$
declare
  v_incident_id text := 'pothole:' || trim(coalesce(new.pothole_id, ''));
  v_current public.incident_state;
  v_next public.incident_state;
  v_ts timestamptz := coalesce(new.created_at, now());
begin
  if new.pothole_id is null or length(trim(new.pothole_id)) = 0 then
    return new;
  end if;

  select state into v_current
  from public.incident_state_current
  where domain = 'potholes'::public.incident_domain and incident_id = v_incident_id;

  if v_current is null then
    v_next := 'reported'::public.incident_state;
  elsif v_current in ('fixed','archived') then
    v_next := 'reopened'::public.incident_state;
  else
    v_next := 'aggregated'::public.incident_state;
  end if;

  perform public.emit_incident_state_change(
    v_incident_id,
    'potholes'::public.incident_domain,
    v_next,
    new.reporter_user_id,
    'user'::public.incident_event_source,
    jsonb_build_object('source_table','pothole_reports','report_id',new.id,'pothole_id',new.pothole_id),
    v_ts,
    false
  );

  return new;
end;
$$;

-- 4) light_actions -> fixed/reopened (+ optional confirmed)
create or replace function public.trg_light_actions_to_incident_events()
returns trigger
language plpgsql
as $$
declare
  v_action text := lower(trim(coalesce(new.action, '')));
  v_domain public.incident_domain := public.map_incident_domain_from_light_id(new.light_id);
  v_incident_id text := trim(coalesce(new.light_id, ''));
  v_next public.incident_state;
  v_ts timestamptz := coalesce(new.created_at, now());
begin
  if v_incident_id = '' then
    return new;
  end if;

  if v_action = 'fix' then
    v_next := 'fixed'::public.incident_state;
  elsif v_action = 'reopen' then
    v_next := 'reopened'::public.incident_state;
  elsif v_action = 'confirm' then
    v_next := 'confirmed'::public.incident_state;
  else
    return new;
  end if;

  perform public.emit_incident_state_change(
    v_incident_id,
    v_domain,
    v_next,
    new.actor_user_id,
    'admin'::public.incident_event_source,
    jsonb_build_object('source_table','light_actions','action_id',new.id,'action',new.action),
    v_ts,
    false
  );

  return new;
end;
$$;

-- 5) Wire triggers only if target tables exist

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema='public' and table_name='reports'
  ) then
    execute 'drop trigger if exists trg_reports_incident_events on public.reports';
    execute 'create trigger trg_reports_incident_events after insert on public.reports for each row execute function public.trg_reports_to_incident_events()';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema='public' and table_name='pothole_reports'
  ) then
    execute 'drop trigger if exists trg_pothole_reports_incident_events on public.pothole_reports';
    execute 'create trigger trg_pothole_reports_incident_events after insert on public.pothole_reports for each row execute function public.trg_pothole_reports_to_incident_events()';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema='public' and table_name='light_actions'
  ) then
    execute 'drop trigger if exists trg_light_actions_incident_events on public.light_actions';
    execute 'create trigger trg_light_actions_incident_events after insert on public.light_actions for each row execute function public.trg_light_actions_to_incident_events()';
  end if;
end
$$;

commit;

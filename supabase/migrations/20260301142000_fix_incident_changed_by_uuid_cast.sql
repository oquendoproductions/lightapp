-- Fix: guest report inserts failing due to '' -> uuid cast in incident event triggers
begin;

create or replace function public.safe_uuid_or_null(p_text text)
returns uuid
language plpgsql
immutable
as $$
declare
  v text := nullif(trim(coalesce(p_text, '')), '');
begin
  if v is null then
    return null;
  end if;

  if v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v::uuid;
  end if;

  return null;
end;
$$;

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
    public.safe_uuid_or_null((new.reporter_user_id)::text),
    'user'::public.incident_event_source,
    jsonb_build_object('source_table','reports','report_id',new.id,'report_type',coalesce(new.report_type, new.type)),
    v_ts,
    false
  );

  return new;
end;
$$;

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
    public.safe_uuid_or_null((new.reporter_user_id)::text),
    'user'::public.incident_event_source,
    jsonb_build_object('source_table','pothole_reports','report_id',new.id,'pothole_id',new.pothole_id),
    v_ts,
    false
  );

  return new;
end;
$$;

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
    public.safe_uuid_or_null((new.actor_user_id)::text),
    'admin'::public.incident_event_source,
    jsonb_build_object('source_table','light_actions','action_id',new.id,'action',new.action),
    v_ts,
    false
  );

  return new;
end;
$$;

commit;

-- Fix: incident trigger compatibility across schema variants (missing NEW.type, text uuid fields)
begin;

create or replace function public.trg_reports_to_incident_events()
returns trigger
language plpgsql
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_type text := lower(trim(coalesce(v_new->>'report_type', v_new->>'type', '')));
  v_quality text := lower(trim(coalesce(v_new->>'report_quality', '')));
  v_domain_text text := v_new->>'report_domain';
  v_light_id text := trim(coalesce(v_new->>'light_id', ''));
  v_reporter uuid := public.safe_uuid_or_null(v_new->>'reporter_user_id');
  v_domain public.incident_domain;
  v_current public.incident_state;
  v_next public.incident_state;
  v_ts timestamptz := coalesce((v_new->>'created_at')::timestamptz, now());
begin
  if v_quality = 'good' or v_type in ('working','reported_working','is_working') then
    return new;
  end if;

  if v_light_id = '' then
    return new;
  end if;

  v_domain := public.map_incident_domain_from_report(v_light_id, v_domain_text, v_type);

  select state into v_current
  from public.incident_state_current
  where domain = v_domain and incident_id = v_light_id;

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
    v_light_id,
    v_domain,
    v_next,
    v_reporter,
    'user'::public.incident_event_source,
    jsonb_build_object('source_table','reports','report_id',v_new->>'id','report_type',v_type),
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
  v_new jsonb := to_jsonb(new);
  v_pothole_id text := trim(coalesce(v_new->>'pothole_id', ''));
  v_incident_id text := 'pothole:' || v_pothole_id;
  v_reporter uuid := public.safe_uuid_or_null(v_new->>'reporter_user_id');
  v_current public.incident_state;
  v_next public.incident_state;
  v_ts timestamptz := coalesce((v_new->>'created_at')::timestamptz, now());
begin
  if v_pothole_id = '' then
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
    v_reporter,
    'user'::public.incident_event_source,
    jsonb_build_object('source_table','pothole_reports','report_id',v_new->>'id','pothole_id',v_pothole_id),
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
  v_new jsonb := to_jsonb(new);
  v_action text := lower(trim(coalesce(v_new->>'action', '')));
  v_light_id text := trim(coalesce(v_new->>'light_id', ''));
  v_actor uuid := public.safe_uuid_or_null(v_new->>'actor_user_id');
  v_domain public.incident_domain := public.map_incident_domain_from_light_id(v_light_id);
  v_next public.incident_state;
  v_ts timestamptz := coalesce((v_new->>'created_at')::timestamptz, now());
begin
  if v_light_id = '' then
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
    v_light_id,
    v_domain,
    v_next,
    v_actor,
    'admin'::public.incident_event_source,
    jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action',v_action),
    v_ts,
    false
  );

  return new;
end;
$$;

commit;

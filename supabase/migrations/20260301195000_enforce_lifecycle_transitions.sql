-- Week 1 hardening: enforce lifecycle transition contract at write-time
-- This migration is intentionally defensive and trigger-compatible with schema variants.

begin;

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

  if not p_force then
    -- Deduplicate same-state churn.
    if v_prev = p_new_state then
      return;
    end if;

    -- Enforce canonical transition contract.
    if not public.is_valid_incident_transition(v_prev, p_new_state) then
      return;
    end if;
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

  -- Keep transitions inside canonical contract.
  if v_current is null then
    v_next := 'reported'::public.incident_state;
  elsif v_current in ('fixed','archived') then
    v_next := 'reopened'::public.incident_state;
  elsif v_current = 'reported' then
    v_next := 'aggregated'::public.incident_state;
  else
    -- aggregated/confirmed/in_progress/reopened: no automatic downgrade/churn
    return new;
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
  elsif v_current = 'reported' then
    v_next := 'aggregated'::public.incident_state;
  else
    return new;
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
  v_current public.incident_state;
  v_ts timestamptz := coalesce((v_new->>'created_at')::timestamptz, now());
begin
  if v_light_id = '' then
    return new;
  end if;

  select state into v_current
  from public.incident_state_current
  where domain = v_domain and incident_id = v_light_id;

  if v_action = 'confirm' then
    perform public.emit_incident_state_change(
      v_light_id,
      v_domain,
      'confirmed'::public.incident_state,
      v_actor,
      'admin'::public.incident_event_source,
      jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action',v_action),
      v_ts,
      false
    );
    return new;
  end if;

  if v_action = 'fix' then
    -- If still early/open, normalize into confirmed first so fixed remains canonical.
    if v_current in ('reported','aggregated','reopened') then
      perform public.emit_incident_state_change(
        v_light_id,
        v_domain,
        'confirmed'::public.incident_state,
        v_actor,
        'admin'::public.incident_event_source,
        jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action','auto_confirm_before_fix'),
        v_ts,
        false
      );
    end if;

    perform public.emit_incident_state_change(
      v_light_id,
      v_domain,
      'fixed'::public.incident_state,
      v_actor,
      'admin'::public.incident_event_source,
      jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action',v_action),
      v_ts,
      false
    );
    return new;
  end if;

  if v_action = 'reopen' then
    perform public.emit_incident_state_change(
      v_light_id,
      v_domain,
      'reopened'::public.incident_state,
      v_actor,
      'admin'::public.incident_event_source,
      jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action',v_action),
      v_ts,
      false
    );
    return new;
  end if;

  return new;
end;
$$;

commit;

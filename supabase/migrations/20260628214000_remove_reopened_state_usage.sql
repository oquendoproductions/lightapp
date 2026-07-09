begin;

-- Normalize any persisted "reopened" states into "reported" so the active lifecycle
-- no longer exposes reopened as a canonical incident state.
update public.incident_events
set new_state = 'reported'::public.incident_state
where new_state = 'reopened'::public.incident_state;

update public.incident_events
set previous_state = 'reported'::public.incident_state
where previous_state = 'reopened'::public.incident_state;

do $$
begin
  perform set_config('cityreport.incident_snapshot_apply', 'on', true);

  truncate table public.incident_state_current;

  insert into public.incident_state_current (
    tenant_key,
    domain,
    incident_id,
    state,
    last_changed_at,
    reopen_count
  )
  select
    latest.tenant_key,
    latest.domain,
    latest.incident_id,
    latest.state,
    latest.changed_at,
    latest.reopen_count
  from (
    select
      coalesce(nullif(trim(e.tenant_key), ''), 'ashtabulacity') as tenant_key,
      e.domain,
      e.incident_id,
      case
        when e.new_state = 'reopened'::public.incident_state then 'reported'::public.incident_state
        else e.new_state
      end as state,
      e.changed_at,
      count(*) filter (
        where coalesce(e.previous_state, 'reported'::public.incident_state) in ('fixed'::public.incident_state, 'archived'::public.incident_state)
          and case
            when e.new_state = 'reopened'::public.incident_state then 'reported'::public.incident_state
            else e.new_state
          end = 'reported'::public.incident_state
      ) over (
        partition by coalesce(nullif(trim(e.tenant_key), ''), 'ashtabulacity'), e.domain, e.incident_id
      ) as reopen_count,
      row_number() over (
        partition by coalesce(nullif(trim(e.tenant_key), ''), 'ashtabulacity'), e.domain, e.incident_id
        order by e.changed_at desc, e.id desc
      ) as row_rank
    from public.incident_events e
  ) latest
  where latest.row_rank = 1;

  perform set_config('cityreport.incident_snapshot_apply', 'off', true);
exception when others then
  perform set_config('cityreport.incident_snapshot_apply', 'off', true);
  raise;
end
$$;

create or replace function public.apply_incident_event_to_snapshot()
returns trigger
language plpgsql
as $$
begin
  perform set_config('cityreport.incident_snapshot_apply', 'on', true);

  insert into public.incident_state_current (
    tenant_key,
    domain,
    incident_id,
    state,
    last_changed_at,
    reopen_count
  )
  values (
    coalesce(new.tenant_key, public.request_tenant_key()),
    new.domain,
    new.incident_id,
    case
      when new.new_state = 'reopened'::public.incident_state then 'reported'::public.incident_state
      else new.new_state
    end,
    new.changed_at,
    case
      when (
        coalesce(new.previous_state, 'reported'::public.incident_state) in ('fixed'::public.incident_state, 'archived'::public.incident_state)
        and coalesce(new.new_state, 'reported'::public.incident_state) = 'reported'::public.incident_state
      ) then 1
      else 0
    end
  )
  on conflict (tenant_key, domain, incident_id)
  do update set
    state = excluded.state,
    last_changed_at = excluded.last_changed_at,
    reopen_count = case
      when (
        coalesce(new.previous_state, 'reported'::public.incident_state) in ('fixed'::public.incident_state, 'archived'::public.incident_state)
        and coalesce(new.new_state, 'reported'::public.incident_state) = 'reported'::public.incident_state
      )
        then public.incident_state_current.reopen_count + 1
      else public.incident_state_current.reopen_count
    end;

  perform set_config('cityreport.incident_snapshot_apply', 'off', true);
  return new;
exception when others then
  perform set_config('cityreport.incident_snapshot_apply', 'off', true);
  raise;
end;
$$;

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
    when prev_state = 'fixed' and next_state in ('reported', 'archived') then true
    else false
  end;
$$;

create or replace function public.trg_reports_to_incident_events()
returns trigger
language plpgsql
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_tenant text := lower(trim(coalesce(v_new->>'tenant_key', public.request_tenant_key())));
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
  if v_tenant = '' then
    v_tenant := 'ashtabulacity';
  end if;

  v_domain := public.map_incident_domain_from_report(v_light_id, v_domain_text, v_type);

  select state into v_current
  from public.incident_state_current
  where tenant_key = v_tenant
    and domain = v_domain
    and incident_id = v_light_id;

  if v_current is null then
    v_next := 'reported'::public.incident_state;
  elsif v_current in ('fixed','archived') then
    v_next := 'reported'::public.incident_state;
  elsif v_current = 'reported' then
    v_next := 'aggregated'::public.incident_state;
  else
    return new;
  end if;

  perform public.emit_incident_state_change_tenant(
    v_tenant,
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
  v_tenant text := lower(trim(coalesce(v_new->>'tenant_key', public.request_tenant_key())));
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
  if v_tenant = '' then
    v_tenant := 'ashtabulacity';
  end if;

  select state into v_current
  from public.incident_state_current
  where tenant_key = v_tenant
    and domain = 'potholes'::public.incident_domain
    and incident_id = v_incident_id;

  if v_current is null then
    v_next := 'reported'::public.incident_state;
  elsif v_current in ('fixed','archived') then
    v_next := 'reported'::public.incident_state;
  elsif v_current = 'reported' then
    v_next := 'aggregated'::public.incident_state;
  else
    return new;
  end if;

  perform public.emit_incident_state_change_tenant(
    v_tenant,
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
  v_tenant text := lower(trim(coalesce(v_new->>'tenant_key', public.request_tenant_key())));
  v_action text := lower(trim(coalesce(v_new->>'action', '')));
  v_light_id text := trim(coalesce(v_new->>'light_id', ''));
  v_actor uuid := public.safe_uuid_or_null(v_new->>'actor_user_id');
  v_domain public.incident_domain := public.map_incident_domain_from_light_id(v_light_id);
  v_current public.incident_state;
  v_ts timestamptz := coalesce((v_new->>'created_at')::timestamptz, now());
  v_force_fix boolean := false;
begin
  if v_light_id = '' then
    return new;
  end if;
  if v_tenant = '' then
    v_tenant := 'ashtabulacity';
  end if;

  select state into v_current
  from public.incident_state_current
  where tenant_key = v_tenant
    and domain = v_domain
    and incident_id = v_light_id;

  if v_action = 'confirm' then
    perform public.emit_incident_state_change_tenant(
      v_tenant,
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
    if v_current in ('reported', 'aggregated') then
      perform public.emit_incident_state_change_tenant(
        v_tenant,
        v_light_id,
        v_domain,
        'confirmed'::public.incident_state,
        v_actor,
        'admin'::public.incident_event_source,
        jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action','auto_confirm_before_fix'),
        v_ts,
        false
      );
    elsif v_current is null then
      v_force_fix := true;
    end if;

    perform public.emit_incident_state_change_tenant(
      v_tenant,
      v_light_id,
      v_domain,
      'fixed'::public.incident_state,
      v_actor,
      'admin'::public.incident_event_source,
      jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action',v_action),
      v_ts,
      v_force_fix
    );
    return new;
  end if;

  if v_action = 'reopen' then
    perform public.emit_incident_state_change_tenant(
      v_tenant,
      v_light_id,
      v_domain,
      'reported'::public.incident_state,
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

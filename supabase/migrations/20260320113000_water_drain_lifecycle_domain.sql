begin;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'incident_domain'
      and e.enumlabel = 'water_drain_issues'
  ) then
    alter type public.incident_domain add value 'water_drain_issues';
  end if;
exception
  when duplicate_object then null;
end
$$;

commit;

begin;

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
  elsif v like 'water_drain_issues:%' then
    return 'water_drain_issues'::public.incident_domain;
  elsif v like 'street_signs:%' then
    return 'street_signs'::public.incident_domain;
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
  if lid like 'potholes:%' or lid like 'pothole:%' then return 'potholes'::public.incident_domain; end if;
  if lid like 'water_drain_issues:%' then return 'water_drain_issues'::public.incident_domain; end if;
  if lid like 'street_signs:%' then return 'street_signs'::public.incident_domain; end if;
  if lid like 'power_outage:%' then return 'power_outage'::public.incident_domain; end if;
  if lid like 'water_main:%' then return 'water_main'::public.incident_domain; end if;

  if d in ('streetlights', 'streetlight') then return 'streetlights'::public.incident_domain; end if;
  if d in ('potholes', 'pothole') then return 'potholes'::public.incident_domain; end if;
  if d in ('street_signs', 'street signs', 'street_sign', 'street sign') then return 'street_signs'::public.incident_domain; end if;
  if d in ('water_drain_issues', 'water drain issues', 'water / drain issues', 'water_drain', 'water drain', 'drain issues', 'drain_issues', 'sewer', 'storm_drain', 'storm drain') then return 'water_drain_issues'::public.incident_domain; end if;
  if d in ('power_outage', 'power outage', 'power', 'outage') then return 'power_outage'::public.incident_domain; end if;
  if d in ('water_main', 'water main', 'water main break', 'water_main_break') then return 'water_main'::public.incident_domain; end if;

  if t like '%pothole%' then return 'potholes'::public.incident_domain; end if;
  if t like '%sewer%' or t like '%drain%' or t like '%storm%' then return 'water_drain_issues'::public.incident_domain; end if;
  if t like '%water_main%' or t like '%main break%' then return 'water_main'::public.incident_domain; end if;
  if t like '%power%' then return 'power_outage'::public.incident_domain; end if;

  return 'streetlights'::public.incident_domain;
end;
$$;

update public.incident_events
set domain = 'water_drain_issues'::public.incident_domain
where incident_id like 'water_drain_issues:%'
  and domain in ('streetlights'::public.incident_domain, 'water_main'::public.incident_domain);

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
    if v_current in ('reported', 'aggregated', 'reopened') then
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
      -- Recovery path: allow fix to materialize when snapshot is missing for this domain.
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

insert into public.tenant_visibility_config (tenant_key, domain, visibility)
values
  ('ashtabulacity', 'water_drain_issues'::public.incident_domain, 'public'),
  ('default', 'water_drain_issues'::public.incident_domain, 'public')
on conflict (tenant_key, domain)
do update set
  visibility = excluded.visibility,
  updated_at = now();

commit;

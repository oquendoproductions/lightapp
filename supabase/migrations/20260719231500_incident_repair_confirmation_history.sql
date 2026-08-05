begin;

drop function if exists public.incident_state_history_tenant(text, public.incident_domain, text);

create function public.incident_state_history_tenant(
  p_tenant_key text,
  p_domain public.incident_domain,
  p_incident_id text
)
returns table (
  history_kind text,
  event_id bigint,
  previous_state public.incident_state,
  new_state public.incident_state,
  changed_by uuid,
  changed_by_name text,
  changed_by_email text,
  changed_by_phone text,
  source public.incident_event_source,
  changed_at timestamptz,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant text := lower(trim(coalesce(p_tenant_key, public.request_tenant_key())));
  v_incident_id text := trim(coalesce(p_incident_id, ''));
  v_user_id uuid := auth.uid();
  v_can_manage boolean := false;
begin
  if v_tenant = '' or v_incident_id = '' or v_user_id is null then
    return;
  end if;

  v_can_manage := coalesce(public.can_access_tenant_domain_reports(v_tenant), false);

  return query
  with history_rows as (
    select
      'state_update'::text as history_kind,
      ie.id as event_id,
      ie.previous_state,
      ie.new_state,
      ie.changed_by,
      ie.source,
      ie.changed_at,
      ie.metadata
    from public.incident_events ie
    where v_can_manage
      and ie.tenant_key = v_tenant
      and ie.domain = p_domain
      and ie.incident_id = v_incident_id

    union all

    select
      'repair_confirmation'::text as history_kind,
      irs.id as event_id,
      null::public.incident_state as previous_state,
      null::public.incident_state as new_state,
      irs.reporter_user_id as changed_by,
      'user'::public.incident_event_source as source,
      irs.created_at as changed_at,
      jsonb_build_object('source', 'resident_repair_confirmation') as metadata
    from public.incident_repair_signals irs
    where irs.tenant_key = v_tenant
      and irs.domain = p_domain
      and trim(irs.incident_id) = v_incident_id
      and (v_can_manage or irs.reporter_user_id = v_user_id)
  )
  select
    h.history_kind,
    h.event_id,
    h.previous_state,
    h.new_state,
    h.changed_by,
    p.full_name as changed_by_name,
    p.email as changed_by_email,
    p.phone as changed_by_phone,
    h.source,
    h.changed_at,
    h.metadata
  from history_rows h
  left join public.profiles p
    on p.user_id = h.changed_by
  order by h.changed_at desc, h.event_id desc;
end;
$$;

revoke all on function public.incident_state_history_tenant(text, public.incident_domain, text) from public;
revoke all on function public.incident_state_history_tenant(text, public.incident_domain, text) from anon;
grant execute on function public.incident_state_history_tenant(text, public.incident_domain, text) to authenticated;

commit;

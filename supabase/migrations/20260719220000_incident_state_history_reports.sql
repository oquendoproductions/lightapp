begin;

create or replace function public.incident_state_history_tenant(
  p_tenant_key text,
  p_domain public.incident_domain,
  p_incident_id text
)
returns table (
  event_id bigint,
  previous_state public.incident_state,
  new_state public.incident_state,
  changed_by uuid,
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
begin
  if v_tenant = '' or v_incident_id = '' then
    return;
  end if;

  if not public.can_access_tenant_domain_reports(v_tenant) then
    raise exception 'Not authorized to view incident state history'
      using errcode = '42501';
  end if;

  return query
  select
    ie.id,
    ie.previous_state,
    ie.new_state,
    ie.changed_by,
    ie.source,
    ie.changed_at,
    ie.metadata
  from public.incident_events ie
  where ie.tenant_key = v_tenant
    and ie.domain = p_domain
    and ie.incident_id = v_incident_id
  order by ie.changed_at desc, ie.id desc;
end;
$$;

revoke all on function public.incident_state_history_tenant(text, public.incident_domain, text) from public;
revoke all on function public.incident_state_history_tenant(text, public.incident_domain, text) from anon;
grant execute on function public.incident_state_history_tenant(text, public.incident_domain, text) to authenticated;

commit;

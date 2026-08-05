-- Resident report-update notification bodies are intentionally two lines:
-- domain name followed by the concrete incident ID. The title contains the
-- lifecycle result, so repeating labels such as "Incident ID" and "Domain"
-- only adds noise.

begin;

create or replace function public.create_resident_incident_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant text := lower(trim(coalesce(new.tenant_key, public.request_tenant_key(), '')));
  v_previous text := coalesce(new.previous_state::text, 'reported');
  v_next text := coalesce(new.new_state::text, 'reported');
  v_state_phrase text;
  v_domain_label text;
  v_title text;
  v_summary text;
begin
  if new.previous_state is null or new.previous_state = new.new_state then
    return new;
  end if;
  if v_tenant = '' then
    return new;
  end if;

  v_state_phrase := case lower(v_next)
    when 'fixed' then 'fixed'
    when 'confirmed' then 'confirmed'
    when 'in_progress' then 'moved to in progress'
    when 'archived' then 'archived'
    else 'updated to ' || replace(lower(v_next), '_', ' ')
  end;
  v_domain_label := initcap(replace(replace(coalesce(new.domain::text, ''), '_', ' '), '-', ' '));
  v_title := 'Your reported issue has been ' || v_state_phrase;
  v_summary := coalesce(nullif(v_domain_label, ''), 'Unknown domain') || E'\n' || new.incident_id;

  insert into public.resident_incident_notifications (
    tenant_key, user_id, incident_event_id, incident_id, domain,
    previous_state, new_state, title, summary, created_at
  )
  select distinct
    v_tenant, prior.changed_by, new.id, new.incident_id, new.domain::text,
    v_previous, v_next, v_title, v_summary, new.changed_at
  from public.incident_events prior
  where prior.tenant_key = v_tenant
    and prior.domain = new.domain
    and prior.incident_id = new.incident_id
    and prior.source = 'user'
    and prior.changed_by is not null
    and prior.changed_by is distinct from new.changed_by
  on conflict (user_id, incident_event_id) do nothing;

  return new;
end;
$$;

update public.resident_incident_notifications
set summary = coalesce(
  nullif(initcap(replace(replace(coalesce(domain, ''), '_', ' '), '-', ' ')), ''),
  'Unknown domain'
) || E'\n' || incident_id;

commit;

-- Keep resident report-update wording and preview metadata consistent across
-- in-app notifications and native iOS push notifications.

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
  v_summary := format('Incident ID: %s · Domain: %s', new.incident_id, coalesce(nullif(v_domain_label, ''), 'Unknown'));

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

-- Update existing notifications too, so residents do not see the old mixed
-- wording while testing the new experience.
update public.resident_incident_notifications
set
  title = 'Your reported issue has been ' || case lower(coalesce(new_state, ''))
    when 'fixed' then 'fixed'
    when 'confirmed' then 'confirmed'
    when 'in_progress' then 'moved to in progress'
    when 'archived' then 'archived'
    else 'updated to ' || replace(lower(coalesce(new_state, 'reported')), '_', ' ')
  end,
  summary = format(
    'Incident ID: %s · Domain: %s',
    incident_id,
    coalesce(nullif(initcap(replace(replace(coalesce(domain, ''), '_', ' '), '-', ' ')), ''), 'Unknown')
  );

commit;

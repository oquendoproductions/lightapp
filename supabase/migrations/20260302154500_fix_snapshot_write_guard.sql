begin;

-- Ensure snapshot writes are only allowed during incident_events trigger application.

create or replace function public.apply_incident_event_to_snapshot()
returns trigger
language plpgsql
as $$
begin
  perform set_config('cityreport.incident_snapshot_apply', 'on', true);

  insert into public.incident_state_current (
    domain,
    incident_id,
    state,
    last_changed_at,
    reopen_count
  )
  values (
    new.domain,
    new.incident_id,
    new.new_state,
    new.changed_at,
    case when new.new_state = 'reopened' then 1 else 0 end
  )
  on conflict (domain, incident_id)
  do update set
    state = excluded.state,
    last_changed_at = excluded.last_changed_at,
    reopen_count = case
      when excluded.state = 'reopened'
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

create or replace function public.guard_incident_state_current_direct_write()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('cityreport.incident_snapshot_apply', true), 'off') <> 'on' then
    raise exception 'incident_state_current is derived from incident_events and cannot be written directly';
  end if;
  return new;
end;
$$;

create or replace function public.guard_incident_state_current_delete()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('cityreport.incident_snapshot_apply', true), 'off') <> 'on' then
    raise exception 'incident_state_current is derived from incident_events and cannot be deleted directly';
  end if;
  return old;
end;
$$;

commit;

begin;

alter table if exists public.abuse_events
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid,
  add column if not exists acknowledgement_note text;

create index if not exists abuse_events_acknowledged_created_idx
  on public.abuse_events (acknowledged_at, created_at desc);

create or replace function public.acknowledge_moderation_flag(
  p_source text,
  p_id bigint,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := lower(trim(coalesce(p_source, '')));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  ) then
    raise exception 'Admin access required';
  end if;

  if p_id is null then
    raise exception 'Missing moderation flag id';
  end if;

  if v_source in ('abuse_anomaly_flags', 'anomaly_flags', 'flags') then
    if to_regclass('public.abuse_anomaly_flags') is null then
      raise exception 'abuse_anomaly_flags table is unavailable';
    end if;

    update public.abuse_anomaly_flags
       set status = 'reviewed',
           reviewed_at = coalesce(reviewed_at, now()),
           reviewed_by = coalesce(reviewed_by, auth.uid()),
           review_note = coalesce(v_note, review_note),
           updated_at = now()
     where id = p_id
       and status = 'open';

    get diagnostics v_count = row_count;
    return v_count > 0;
  end if;

  if v_source in ('abuse_events', 'events', 'telemetry') then
    if to_regclass('public.abuse_events') is null then
      raise exception 'abuse_events table is unavailable';
    end if;

    update public.abuse_events
       set acknowledged_at = coalesce(acknowledged_at, now()),
           acknowledged_by = coalesce(acknowledged_by, auth.uid()),
           acknowledgement_note = coalesce(v_note, acknowledgement_note)
     where id = p_id
       and acknowledged_at is null;

    get diagnostics v_count = row_count;
    return v_count > 0;
  end if;

  raise exception 'Unsupported moderation flag source: %', p_source;
end;
$$;

revoke all on function public.acknowledge_moderation_flag(text, bigint, text) from public;
grant execute on function public.acknowledge_moderation_flag(text, bigint, text) to authenticated;

commit;

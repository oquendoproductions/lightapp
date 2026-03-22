begin;

create table if not exists public.abuse_anomaly_flags (
  id bigserial primary key,
  domain text not null,
  identity_hash text,
  ip_hash text,
  reason text not null,
  severity smallint not null default 1 check (severity between 1 and 3),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  hit_count integer not null default 1 check (hit_count >= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abuse_anomaly_flags_status_last_seen_idx
  on public.abuse_anomaly_flags (status, last_seen_at desc);

create index if not exists abuse_anomaly_flags_domain_status_idx
  on public.abuse_anomaly_flags (domain, status, severity desc, last_seen_at desc);

create index if not exists abuse_anomaly_flags_identity_reason_idx
  on public.abuse_anomaly_flags (domain, identity_hash, reason, status)
  where identity_hash is not null;

alter table public.abuse_anomaly_flags enable row level security;
alter table public.abuse_anomaly_flags force row level security;

revoke all on table public.abuse_anomaly_flags from anon, authenticated;
revoke all on sequence public.abuse_anomaly_flags_id_seq from anon, authenticated;

drop policy if exists abuse_anomaly_flags_select_admin on public.abuse_anomaly_flags;
create policy abuse_anomaly_flags_select_admin
on public.abuse_anomaly_flags
for select
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists abuse_anomaly_flags_update_admin on public.abuse_anomaly_flags;
create policy abuse_anomaly_flags_update_admin
on public.abuse_anomaly_flags
for update
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

drop function if exists public.raise_abuse_flag(text,text,text,text,smallint,jsonb);
create or replace function public.raise_abuse_flag(
  p_domain text,
  p_identity_hash text,
  p_ip_hash text,
  p_reason text,
  p_severity smallint default 1,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  select f.id
    into v_id
  from public.abuse_anomaly_flags f
  where f.status = 'open'
    and f.domain = coalesce(nullif(trim(p_domain), ''), 'streetlights')
    and f.reason = coalesce(nullif(trim(p_reason), ''), 'unknown')
    and (
      (p_identity_hash is not null and f.identity_hash = p_identity_hash)
      or (p_ip_hash is not null and f.ip_hash = p_ip_hash)
    )
  order by f.last_seen_at desc, f.id desc
  limit 1;

  if v_id is null then
    insert into public.abuse_anomaly_flags (
      domain, identity_hash, ip_hash, reason, severity, status,
      hit_count, first_seen_at, last_seen_at, metadata, created_at, updated_at
    )
    values (
      coalesce(nullif(trim(p_domain), ''), 'streetlights'),
      nullif(trim(p_identity_hash), ''),
      nullif(trim(p_ip_hash), ''),
      coalesce(nullif(trim(p_reason), ''), 'unknown'),
      greatest(1, least(3, coalesce(p_severity, 1))),
      'open',
      1,
      now(),
      now(),
      coalesce(p_metadata, '{}'::jsonb),
      now(),
      now()
    )
    returning id into v_id;
  else
    update public.abuse_anomaly_flags
    set
      hit_count = hit_count + 1,
      severity = greatest(severity, greatest(1, least(3, coalesce(p_severity, 1)))),
      last_seen_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
    where id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.raise_abuse_flag(text,text,text,text,smallint,jsonb) from public;

drop function if exists public.trg_abuse_rate_events_anomaly();
create or replace function public.trg_abuse_rate_events_anomaly()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval;
  v_units_recent integer := 0;
  v_events_recent integer := 0;
  v_row_units integer := 1;
  v_reason text := null;
  v_severity smallint := 1;
begin
  v_window := interval '1 millisecond' * greatest(1000, least(3600000, coalesce(new.window_ms, 60000)));
  v_row_units := greatest(
    1,
    coalesce(
      nullif((new.metadata ->> 'unit_count')::integer, 0),
      nullif((new.metadata ->> 'action_count')::integer, 0),
      new.event_count,
      1
    )
  );

  select
    coalesce(sum(greatest(1, coalesce(e.event_count, 1))), 0)::integer as events_recent,
    coalesce(
      sum(
        greatest(
          1,
          coalesce(
            nullif((e.metadata ->> 'unit_count')::integer, 0),
            nullif((e.metadata ->> 'action_count')::integer, 0),
            e.event_count,
            1
          )
        )
      ),
      0
    )::integer as units_recent
  into v_events_recent, v_units_recent
  from public.abuse_rate_events e
  where e.domain = new.domain
    and e.created_at >= (new.created_at - v_window)
    and (
      (new.identity_hash is not null and e.identity_hash = new.identity_hash)
      or (new.ip_hash is not null and e.ip_hash = new.ip_hash)
    );

  if v_units_recent >= 20 then
    v_reason := 'unit_limit_pressure';
    v_severity := 3;
  elsif v_events_recent >= 7 then
    v_reason := 'event_limit_pressure';
    v_severity := 2;
  elsif v_row_units >= 10 then
    v_reason := 'single_bulk_spike';
    v_severity := 2;
  elsif v_events_recent >= 5 then
    v_reason := 'high_velocity';
    v_severity := 1;
  end if;

  if v_reason is not null then
    perform public.raise_abuse_flag(
      p_domain := new.domain,
      p_identity_hash := new.identity_hash,
      p_ip_hash := new.ip_hash,
      p_reason := v_reason,
      p_severity := v_severity,
      p_metadata := jsonb_build_object(
        'events_recent', v_events_recent,
        'units_recent', v_units_recent,
        'window_ms', new.window_ms,
        'event_count', new.event_count,
        'unit_count', v_row_units,
        'domain', new.domain
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_abuse_rate_events_anomaly on public.abuse_rate_events;
create trigger trg_abuse_rate_events_anomaly
after insert on public.abuse_rate_events
for each row execute function public.trg_abuse_rate_events_anomaly();

create or replace view public.metrics_open_abuse_flags_v1 as
select
  domain,
  reason,
  severity,
  count(*)::bigint as open_flag_count,
  max(last_seen_at) as last_seen_at
from public.abuse_anomaly_flags
where status = 'open'
group by domain, reason, severity
order by severity desc, open_flag_count desc, last_seen_at desc;

grant select on public.metrics_open_abuse_flags_v1 to anon, authenticated;

commit;

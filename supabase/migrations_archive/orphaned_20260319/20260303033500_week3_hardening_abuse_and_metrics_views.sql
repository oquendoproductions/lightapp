begin;

-- Week 3 hardening:
-- 1) Abuse telemetry table
-- 2) Public/internal metrics view separation with tighter permissions
-- 3) Admin-only moderation metrics visibility

create table if not exists public.abuse_events (
  id bigserial primary key,
  domain text not null,
  identity_hash text,
  ip_hash text,
  event_kind text not null,
  allowed boolean not null default true,
  event_count integer not null default 1 check (event_count >= 1),
  unit_count integer not null default 1 check (unit_count >= 1),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists abuse_events_created_at_idx
  on public.abuse_events (created_at desc);

create index if not exists abuse_events_domain_created_idx
  on public.abuse_events (domain, created_at desc);

create index if not exists abuse_events_identity_created_idx
  on public.abuse_events (identity_hash, created_at desc)
  where identity_hash is not null;

alter table public.abuse_events enable row level security;
alter table public.abuse_events force row level security;

revoke all on table public.abuse_events from public, anon, authenticated;
revoke all on sequence public.abuse_events_id_seq from public, anon, authenticated;

drop policy if exists abuse_events_select_admin on public.abuse_events;
create policy abuse_events_select_admin
on public.abuse_events
for select
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists abuse_events_update_admin on public.abuse_events;
create policy abuse_events_update_admin
on public.abuse_events
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

-- Public/internal metrics separation wrappers (Model C)
create or replace view public.public_metrics_view as
select
  domain,
  open_count,
  closed_count,
  avg_time_to_fix_seconds,
  reopen_rate_percent,
  last_updated_at
from public.public_metrics_summary_v1;

create or replace view public.internal_metrics_view as
select *
from public.internal_metrics_accountability_v1
where exists (
  select 1
  from public.admins a
  where a.user_id = auth.uid()
);

revoke all on public.public_metrics_view from public;
revoke all on public.internal_metrics_view from public;
revoke all on public.internal_metrics_accountability_v1 from anon, authenticated;

grant select on public.public_metrics_view to anon, authenticated;
grant select on public.internal_metrics_view to authenticated;

-- Keep moderation summary readable only by admins without throwing 403 for authenticated callers.
create or replace view public.metrics_open_abuse_flags_v1 as
select
  domain,
  reason,
  severity,
  count(*)::bigint as open_flag_count,
  max(last_seen_at) as last_seen_at
from public.abuse_anomaly_flags
where status = 'open'
  and exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
group by domain, reason, severity
order by severity desc, open_flag_count desc, last_seen_at desc;

revoke all on public.metrics_open_abuse_flags_v1 from public;
grant select on public.metrics_open_abuse_flags_v1 to authenticated;

commit;

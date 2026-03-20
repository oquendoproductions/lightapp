begin;

create table if not exists public.abuse_rate_events (
  id bigserial primary key,
  domain text not null,
  identity_hash text not null,
  ip_hash text,
  event_count integer not null default 1 check (event_count >= 1 and event_count <= 100),
  window_ms integer not null default 60000 check (window_ms >= 1000 and window_ms <= 3600000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists abuse_rate_events_domain_identity_created_idx
  on public.abuse_rate_events (domain, identity_hash, created_at desc);

create index if not exists abuse_rate_events_domain_ip_created_idx
  on public.abuse_rate_events (domain, ip_hash, created_at desc)
  where ip_hash is not null;

create index if not exists abuse_rate_events_created_at_idx
  on public.abuse_rate_events (created_at desc);

alter table public.abuse_rate_events enable row level security;
alter table public.abuse_rate_events force row level security;

revoke all on table public.abuse_rate_events from anon, authenticated;
revoke all on sequence public.abuse_rate_events_id_seq from anon, authenticated;

create or replace function public.prune_abuse_rate_events(p_retention interval default interval '7 days')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  delete from public.abuse_rate_events
  where created_at < now() - coalesce(p_retention, interval '7 days');

  get diagnostics v_deleted = row_count;
  return coalesce(v_deleted, 0);
end;
$$;

revoke all on function public.prune_abuse_rate_events(interval) from public;

commit;

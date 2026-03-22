begin;

-- 1) Objects exist
select
  'abuse_anomaly_flags_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema='public' and table_name='abuse_anomaly_flags'
  ) as ok;

select
  'metrics_open_abuse_flags_view_exists' as check_name,
  exists (
    select 1
    from information_schema.views
    where table_schema='public' and table_name='metrics_open_abuse_flags_v1'
  ) as ok;

select
  'abuse_trigger_exists' as check_name,
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='abuse_rate_events'
      and t.tgname='trg_abuse_rate_events_anomaly'
      and not t.tgisinternal
  ) as ok;

-- 2) Trigger behavior: insert one high-unit event and assert at least one open flag
insert into public.abuse_rate_events (
  domain,
  identity_hash,
  ip_hash,
  event_count,
  window_ms,
  metadata
) values (
  'streetlights',
  'smoke_identity_hash',
  'smoke_ip_hash',
  1,
  60000,
  jsonb_build_object('unit_count', 10, 'source', 'week3_smoke')
);

select
  id,
  domain,
  reason,
  severity,
  status,
  hit_count,
  first_seen_at,
  last_seen_at
from public.abuse_anomaly_flags
where identity_hash = 'smoke_identity_hash'
order by id desc
limit 5;

select
  domain,
  reason,
  severity,
  open_flag_count,
  last_seen_at
from public.metrics_open_abuse_flags_v1
where domain = 'streetlights'
order by severity desc, open_flag_count desc, last_seen_at desc
limit 10;

rollback;

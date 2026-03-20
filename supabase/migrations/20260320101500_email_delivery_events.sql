begin;

create table if not exists public.email_delivery_events (
  id bigint generated always as identity primary key,
  tenant_key text not null,
  domain text not null check (domain in ('potholes', 'water_drain_issues', 'lead_capture', 'other')),
  report_number text,
  recipient_email text,
  provider text not null default 'resend',
  provider_message_id text,
  http_status integer,
  success boolean not null,
  error_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_delivery_events_tenant_created_idx
  on public.email_delivery_events (tenant_key, created_at desc);

create index if not exists email_delivery_events_domain_created_idx
  on public.email_delivery_events (domain, created_at desc);

create index if not exists email_delivery_events_success_created_idx
  on public.email_delivery_events (success, created_at desc);

create or replace view public.email_delivery_daily_metrics as
select
  tenant_key,
  domain,
  (created_at at time zone 'utc')::date as delivery_day_utc,
  count(*) as attempt_count,
  count(*) filter (where success) as success_count,
  count(*) filter (where not success) as failure_count,
  case
    when count(*) = 0 then 0::numeric
    else round((count(*) filter (where success))::numeric * 100.0 / count(*)::numeric, 2)
  end as success_rate_pct
from public.email_delivery_events
group by tenant_key, domain, (created_at at time zone 'utc')::date;

alter table public.email_delivery_events enable row level security;

drop policy if exists email_delivery_events_select_platform_admin on public.email_delivery_events;
create policy email_delivery_events_select_platform_admin
on public.email_delivery_events
for select
to authenticated
using (public.is_platform_admin(auth.uid()));

commit;

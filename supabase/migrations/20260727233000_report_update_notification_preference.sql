-- A first-class resident preference for private lifecycle updates on reports
-- they submitted.  This is intentionally a tenant communication topic so it
-- appears in the same preference surface as alerts and events.

begin;

insert into public.notification_topics (
  tenant_key, topic_key, label, description, default_enabled, active, sort_order, topic_kind
)
select
  t.tenant_key,
  'report_updates',
  'Report updates',
  'Status changes and fixes for issues you reported.',
  false,
  true,
  5,
  'alert'
from public.tenants t
on conflict (tenant_key, topic_key) do update set
  label = excluded.label,
  description = excluded.description,
  active = true,
  sort_order = excluded.sort_order;

commit;

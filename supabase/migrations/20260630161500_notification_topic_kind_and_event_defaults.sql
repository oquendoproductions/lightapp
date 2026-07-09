alter table public.notification_topics
  add column if not exists topic_kind text not null default 'alert';

alter table public.notification_topics
  drop constraint if exists notification_topics_kind_check;

alter table public.notification_topics
  add constraint notification_topics_kind_check
  check (topic_kind in ('alert', 'event'));

update public.notification_topics
set
  label = seed.label,
  description = seed.description,
  default_enabled = seed.default_enabled,
  sort_order = seed.sort_order,
  topic_kind = seed.topic_kind,
  active = true,
  updated_at = now()
from (
  values
    ('emergency_alerts', 'Emergency Alerts', 'Urgent location-wide issues that need immediate attention.', true, 10, 'alert'),
    ('water_utility', 'Water + Utility', 'Water breaks, outages, boil advisories, and utility service notices.', true, 20, 'alert'),
    ('road_closures', 'Road Closures', 'Closures, detours, and traffic-impacting work that residents should route around.', true, 30, 'alert'),
    ('street_maintenance', 'Street Maintenance', 'Planned work on streets, sidewalks, signs, lights, and right-of-way assets.', true, 40, 'alert'),
    ('trash_recycling', 'Trash + Recycling', 'Pickup changes, holiday schedules, and sanitation reminders.', false, 50, 'alert'),
    ('general_updates', 'General City Updates', 'Broad municipality updates that do not fit a more specific alert topic.', false, 60, 'alert'),
    ('community_events', 'Community Events', 'General city-hosted community gatherings and civic events.', false, 70, 'event')
) as seed(topic_key, label, description, default_enabled, sort_order, topic_kind)
where public.notification_topics.topic_key = seed.topic_key;

insert into public.notification_topics (
  tenant_key,
  topic_key,
  label,
  description,
  default_enabled,
  active,
  sort_order,
  topic_kind
)
select
  t.tenant_key,
  seed.topic_key,
  seed.label,
  seed.description,
  seed.default_enabled,
  true,
  seed.sort_order,
  seed.topic_kind
from public.tenants t
cross join (
  values
    ('parades', 'Parades', 'Parades, marches, and procession-style events.', false, 80, 'event'),
    ('festivals', 'Festivals', 'Festivals, fairs, celebrations, and similar public events.', false, 90, 'event'),
    ('public_meetings', 'Meetings', 'Public meetings, hearings, workshops, and civic sessions.', false, 100, 'event')
) as seed(topic_key, label, description, default_enabled, sort_order, topic_kind)
on conflict (tenant_key, topic_key) do update
set
  label = excluded.label,
  description = excluded.description,
  default_enabled = excluded.default_enabled,
  active = public.notification_topics.active,
  sort_order = excluded.sort_order,
  topic_kind = excluded.topic_kind,
  updated_at = now();

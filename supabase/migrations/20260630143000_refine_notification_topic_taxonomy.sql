update public.notification_topics
set
  label = seed.label,
  description = seed.description,
  default_enabled = seed.default_enabled,
  sort_order = seed.sort_order,
  active = true,
  updated_at = now()
from (
  values
    ('emergency_alerts', 'Emergency Alerts', 'Urgent location-wide issues that need immediate attention.', true, 10),
    ('water_utility', 'Utilities + Water', 'Water breaks, outages, boil advisories, and utility service notices.', true, 20),
    ('road_closures', 'Traffic + Road Closures', 'Closures, detours, and traffic-impacting work that residents should route around.', true, 30),
    ('street_maintenance', 'Public Works + Maintenance', 'Planned work on streets, sidewalks, signs, lights, and right-of-way assets.', true, 40),
    ('trash_recycling', 'Trash + Recycling', 'Pickup changes, holiday schedules, and sanitation reminders.', false, 50),
    ('community_events', 'Community Events + Meetings', 'Community gatherings, public meetings, hearings, and city-hosted civic events.', false, 60),
    ('general_updates', 'General Updates', 'Broad municipality updates that do not fit a more specific alert or event topic.', false, 70)
) as seed(topic_key, label, description, default_enabled, sort_order)
where public.notification_topics.topic_key = seed.topic_key;

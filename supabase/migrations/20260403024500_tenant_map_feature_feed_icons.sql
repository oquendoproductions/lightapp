alter table if exists public.tenant_map_features
  add column if not exists show_alert_icon boolean not null default true,
  add column if not exists show_event_icon boolean not null default true;

update public.tenant_map_features
set
  show_alert_icon = coalesce(show_alert_icon, true),
  show_event_icon = coalesce(show_event_icon, true)
where show_alert_icon is distinct from true
   or show_event_icon is distinct from true;

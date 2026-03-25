begin;

-- ---------------------------------------------------------------------------
-- Municipality updates hub: resident alerts, civic events, and notification
-- preferences. Built to stay web-first while remaining app-ready.
-- ---------------------------------------------------------------------------

insert into public.tenant_permissions_catalog (permission_key, module_key, action_key, label, sort_order)
values
  ('communications.access', 'communications', 'access', 'Communications access', 70),
  ('communications.edit', 'communications', 'edit', 'Communications edit', 71),
  ('communications.delete', 'communications', 'delete', 'Communications delete', 72)
on conflict (permission_key) do update
set
  module_key = excluded.module_key,
  action_key = excluded.action_key,
  label = excluded.label,
  sort_order = excluded.sort_order;

insert into public.tenant_role_permissions (tenant_key, role, permission_key, allowed)
select
  trd.tenant_key,
  trd.role,
  tpc.permission_key,
  case
    when trd.role = 'tenant_admin' then true
    else false
  end as allowed
from public.tenant_role_definitions trd
join public.tenant_permissions_catalog tpc
  on tpc.permission_key in (
    'communications.access',
    'communications.edit',
    'communications.delete'
  )
on conflict (tenant_key, role, permission_key) do update
set
  allowed = excluded.allowed;

create or replace function public.can_manage_tenant_communications(p_tenant text default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and (
      public.is_platform_admin(auth.uid())
      or public.is_tenant_admin(auth.uid(), p_tenant)
      or public.has_tenant_permission(auth.uid(), p_tenant, 'communications.edit')
    );
$$;

grant execute on function public.can_manage_tenant_communications(text) to anon, authenticated;

create table if not exists public.notification_topics (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  topic_key text not null,
  label text not null,
  description text not null default '',
  default_enabled boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_key, topic_key),
  constraint notification_topics_key_check
    check (topic_key ~ '^[a-z][a-z0-9_]{1,39}$')
);

create table if not exists public.municipality_alerts (
  id bigint generated always as identity primary key,
  tenant_key text not null references public.tenants(tenant_key) on delete cascade default public.request_tenant_key(),
  topic_key text not null,
  title text not null,
  summary text not null default '',
  body text not null default '',
  severity text not null default 'info'
    check (severity in ('info', 'advisory', 'urgent', 'emergency')),
  location_name text not null default '',
  location_address text not null default '',
  cta_label text not null default '',
  cta_url text not null default '',
  pinned boolean not null default false,
  delivery_channels text[] not null default array['in_app']::text[],
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid default auth.uid(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint municipality_alerts_topic_fkey
    foreign key (tenant_key, topic_key)
    references public.notification_topics(tenant_key, topic_key)
    on delete restrict
);

create table if not exists public.municipality_events (
  id bigint generated always as identity primary key,
  tenant_key text not null references public.tenants(tenant_key) on delete cascade default public.request_tenant_key(),
  topic_key text not null,
  title text not null,
  summary text not null default '',
  body text not null default '',
  location_name text not null default '',
  location_address text not null default '',
  cta_label text not null default '',
  cta_url text not null default '',
  all_day boolean not null default false,
  delivery_channels text[] not null default array['in_app']::text[],
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid default auth.uid(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint municipality_events_topic_fkey
    foreign key (tenant_key, topic_key)
    references public.notification_topics(tenant_key, topic_key)
    on delete restrict
);

create table if not exists public.resident_notification_preferences (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade default public.request_tenant_key(),
  user_id uuid not null,
  topic_key text not null,
  in_app_enabled boolean not null default false,
  email_enabled boolean not null default false,
  web_push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_key, user_id, topic_key),
  constraint resident_notification_preferences_topic_fkey
    foreign key (tenant_key, topic_key)
    references public.notification_topics(tenant_key, topic_key)
    on delete cascade
);

create index if not exists municipality_alerts_tenant_status_start_idx
  on public.municipality_alerts (tenant_key, status, starts_at desc, created_at desc);

create index if not exists municipality_events_tenant_status_start_idx
  on public.municipality_events (tenant_key, status, starts_at asc, created_at desc);

create index if not exists resident_notification_preferences_user_idx
  on public.resident_notification_preferences (tenant_key, user_id, updated_at desc);

insert into public.notification_topics (
  tenant_key,
  topic_key,
  label,
  description,
  default_enabled,
  active,
  sort_order
)
select
  t.tenant_key,
  seed.topic_key,
  seed.label,
  seed.description,
  seed.default_enabled,
  true,
  seed.sort_order
from public.tenants t
cross join (
  values
    ('emergency_alerts', 'Emergency Alerts', 'Urgent citywide issues that need immediate attention.', true, 10),
    ('water_utility', 'Water + Utility', 'Water main breaks, outages, boil advisories, and utility notices.', true, 20),
    ('road_closures', 'Road Closures', 'Street closures, detours, and traffic-impacting maintenance.', true, 30),
    ('street_maintenance', 'Street Maintenance', 'Planned work on streets, lights, and right-of-way assets.', true, 40),
    ('trash_recycling', 'Trash + Recycling', 'Pickup changes, holiday schedules, and sanitation reminders.', false, 50),
    ('community_events', 'Community Events', 'Parades, public meetings, and city-run events.', false, 60),
    ('general_updates', 'General City Updates', 'Broad municipality notices that do not fit another topic.', false, 70)
) as seed(topic_key, label, description, default_enabled, sort_order)
on conflict (tenant_key, topic_key) do update
set
  label = excluded.label,
  description = excluded.description,
  default_enabled = excluded.default_enabled,
  active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

drop trigger if exists trg_notification_topics_updated_at on public.notification_topics;
create trigger trg_notification_topics_updated_at
before update on public.notification_topics
for each row
execute function public.touch_platform_control_plane_updated_at();

drop trigger if exists trg_municipality_alerts_updated_at on public.municipality_alerts;
create trigger trg_municipality_alerts_updated_at
before update on public.municipality_alerts
for each row
execute function public.touch_platform_control_plane_updated_at();

drop trigger if exists trg_municipality_events_updated_at on public.municipality_events;
create trigger trg_municipality_events_updated_at
before update on public.municipality_events
for each row
execute function public.touch_platform_control_plane_updated_at();

drop trigger if exists trg_resident_notification_preferences_updated_at on public.resident_notification_preferences;
create trigger trg_resident_notification_preferences_updated_at
before update on public.resident_notification_preferences
for each row
execute function public.touch_platform_control_plane_updated_at();

grant select on public.notification_topics to anon, authenticated;
grant select on public.municipality_alerts to anon, authenticated;
grant select on public.municipality_events to anon, authenticated;
grant select, insert, update, delete on public.notification_topics to authenticated;
grant insert, update, delete on public.municipality_alerts to authenticated;
grant insert, update, delete on public.municipality_events to authenticated;
grant select, insert, update, delete on public.resident_notification_preferences to authenticated;

alter table public.notification_topics enable row level security;
alter table public.municipality_alerts enable row level security;
alter table public.municipality_events enable row level security;
alter table public.resident_notification_preferences enable row level security;

drop policy if exists notification_topics_select_public on public.notification_topics;
create policy notification_topics_select_public
on public.notification_topics
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
  and (
    active = true
    or public.can_manage_tenant_communications(tenant_key)
  )
);

drop policy if exists notification_topics_manage_editor on public.notification_topics;
create policy notification_topics_manage_editor
on public.notification_topics
for all
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
)
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists municipality_alerts_select_scoped on public.municipality_alerts;
create policy municipality_alerts_select_scoped
on public.municipality_alerts
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
  and (
    status = 'published'
    or public.can_manage_tenant_communications(tenant_key)
  )
);

drop policy if exists municipality_alerts_manage_editor on public.municipality_alerts;
create policy municipality_alerts_manage_editor
on public.municipality_alerts
for all
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
)
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists municipality_events_select_scoped on public.municipality_events;
create policy municipality_events_select_scoped
on public.municipality_events
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
  and (
    status = 'published'
    or public.can_manage_tenant_communications(tenant_key)
  )
);

drop policy if exists municipality_events_manage_editor on public.municipality_events;
create policy municipality_events_manage_editor
on public.municipality_events
for all
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
)
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists resident_notification_preferences_select_self on public.resident_notification_preferences;
create policy resident_notification_preferences_select_self
on public.resident_notification_preferences
for select
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

drop policy if exists resident_notification_preferences_insert_self on public.resident_notification_preferences;
create policy resident_notification_preferences_insert_self
on public.resident_notification_preferences
for insert
to authenticated
with check (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

drop policy if exists resident_notification_preferences_update_self on public.resident_notification_preferences;
create policy resident_notification_preferences_update_self
on public.resident_notification_preferences
for update
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
)
with check (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

drop policy if exists resident_notification_preferences_delete_self on public.resident_notification_preferences;
create policy resident_notification_preferences_delete_self
on public.resident_notification_preferences
for delete
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

commit;

begin;

create table if not exists public.domain_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique
    check (key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  label text not null,
  description text,
  domain_class text not null
    check (domain_class in ('incident_driven', 'asset_backed')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  icon_key text,
  icon_src text,
  ownership_model text not null default 'org_managed'
    check (ownership_model in ('org_managed', 'utility_managed', 'third_party')),
  report_prefix text,
  default_visibility text not null default 'enabled'
    check (default_visibility in ('enabled', 'disabled')),
  default_notification_email text,
  default_organization_monitored_repairs boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

drop trigger if exists trg_domain_definitions_updated_at on public.domain_definitions;
create trigger trg_domain_definitions_updated_at
before update on public.domain_definitions
for each row
execute function public.touch_platform_control_plane_updated_at();

alter table public.domain_definitions enable row level security;
grant select, insert, update, delete on public.domain_definitions to authenticated;

drop policy if exists domain_definitions_select on public.domain_definitions;
create policy domain_definitions_select
on public.domain_definitions
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.access')
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

drop policy if exists domain_definitions_manage on public.domain_definitions;
create policy domain_definitions_manage
on public.domain_definitions
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

create table if not exists public.domain_issue_types (
  id uuid primary key default gen_random_uuid(),
  domain_key text not null references public.domain_definitions(key) on delete cascade,
  issue_key text not null
    check (issue_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  issue_label text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain_key, issue_key)
);

drop trigger if exists trg_domain_issue_types_updated_at on public.domain_issue_types;
create trigger trg_domain_issue_types_updated_at
before update on public.domain_issue_types
for each row
execute function public.touch_platform_control_plane_updated_at();

alter table public.domain_issue_types enable row level security;
grant select, insert, update, delete on public.domain_issue_types to authenticated;

drop policy if exists domain_issue_types_select on public.domain_issue_types;
create policy domain_issue_types_select
on public.domain_issue_types
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.access')
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

drop policy if exists domain_issue_types_manage on public.domain_issue_types;
create policy domain_issue_types_manage
on public.domain_issue_types
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

create table if not exists public.tenant_domain_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  domain_key text not null references public.domain_definitions(key) on delete cascade,
  active boolean not null default false,
  visibility text not null default 'enabled'
    check (visibility in ('enabled', 'disabled')),
  notification_email text,
  organization_monitored_repairs boolean not null default false,
  billing_status text not null default 'not_applicable'
    check (billing_status in ('not_applicable', 'pending_review', 'approved', 'waived')),
  billing_model text not null default 'included'
    check (billing_model in ('included', 'add_on', 'custom')),
  billing_amount numeric(10,2) not null default 0,
  billing_notes text,
  activated_at timestamptz,
  activated_by uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (tenant_key, domain_key)
);

drop trigger if exists trg_tenant_domain_assignments_updated_at on public.tenant_domain_assignments;
create trigger trg_tenant_domain_assignments_updated_at
before update on public.tenant_domain_assignments
for each row
execute function public.touch_platform_control_plane_updated_at();

alter table public.tenant_domain_assignments enable row level security;
grant select, insert, update, delete on public.tenant_domain_assignments to authenticated;

drop policy if exists tenant_domain_assignments_select on public.tenant_domain_assignments;
create policy tenant_domain_assignments_select
on public.tenant_domain_assignments
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.access')
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

drop policy if exists tenant_domain_assignments_manage on public.tenant_domain_assignments;
create policy tenant_domain_assignments_manage
on public.tenant_domain_assignments
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

create table if not exists public.domain_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  domain_key text not null references public.domain_definitions(key) on delete cascade,
  asset_id text not null,
  asset_label text,
  latitude numeric(10,7) not null check (latitude between -90 and 90),
  longitude numeric(10,7) not null check (longitude between -180 and 180),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  metadata_json jsonb not null default '{}'::jsonb,
  source text not null default 'manual'
    check (source in ('manual', 'csv_import')),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (tenant_key, domain_key, asset_id)
);

drop trigger if exists trg_domain_assets_updated_at on public.domain_assets;
create trigger trg_domain_assets_updated_at
before update on public.domain_assets
for each row
execute function public.touch_platform_control_plane_updated_at();

alter table public.domain_assets enable row level security;
grant select, insert, update, delete on public.domain_assets to authenticated;

drop policy if exists domain_assets_select on public.domain_assets;
create policy domain_assets_select
on public.domain_assets
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.access')
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

drop policy if exists domain_assets_manage on public.domain_assets;
create policy domain_assets_manage
on public.domain_assets
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

create index if not exists idx_domain_definitions_status_sort
  on public.domain_definitions(status, sort_order, label);

create index if not exists idx_domain_issue_types_domain_sort
  on public.domain_issue_types(domain_key, active, sort_order);

create index if not exists idx_tenant_domain_assignments_tenant_active
  on public.tenant_domain_assignments(tenant_key, active);

create index if not exists idx_tenant_domain_assignments_domain_active
  on public.tenant_domain_assignments(domain_key, active);

create index if not exists idx_domain_assets_tenant_domain_status
  on public.domain_assets(tenant_key, domain_key, status);

insert into public.domain_definitions (
  key,
  label,
  description,
  domain_class,
  status,
  icon_key,
  ownership_model,
  report_prefix,
  default_visibility,
  default_notification_email,
  default_organization_monitored_repairs,
  sort_order,
  created_by,
  updated_by
)
values
  ('streetlights', 'Streetlights', 'Asset-backed reporting for utility or municipal streetlight inventories.', 'asset_backed', 'active', 'streetlights', 'utility_managed', 'SL', 'enabled', null, true, 10, null, null),
  ('street_signs', 'Street Signs', 'Incident-driven reporting for damaged, blocked, or missing signs.', 'incident_driven', 'active', 'street_signs', 'org_managed', 'SS', 'enabled', null, true, 20, null, null),
  ('potholes', 'Potholes', 'Resident and staff reporting for pothole observations and follow-up.', 'incident_driven', 'active', 'potholes', 'org_managed', 'PH', 'enabled', null, true, 30, null, null),
  ('water_drain_issues', 'Water / Drain', 'Incident-driven drainage and standing water reporting.', 'incident_driven', 'active', 'water_drain_issues', 'org_managed', 'WD', 'enabled', null, true, 40, null, null),
  ('power_outage', 'Power Outage', 'Incident-driven utility outage reporting.', 'incident_driven', 'active', 'power_outage', 'utility_managed', 'PO', 'enabled', null, true, 50, null, null),
  ('water_main', 'Water Main', 'Incident-driven water main break and service issue reporting.', 'incident_driven', 'active', 'water_main', 'utility_managed', 'WM', 'enabled', null, true, 60, null, null)
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  domain_class = excluded.domain_class,
  status = excluded.status,
  icon_key = excluded.icon_key,
  ownership_model = excluded.ownership_model,
  report_prefix = excluded.report_prefix,
  default_visibility = excluded.default_visibility,
  default_organization_monitored_repairs = excluded.default_organization_monitored_repairs,
  sort_order = excluded.sort_order,
  updated_at = now(),
  updated_by = excluded.updated_by;

insert into public.domain_issue_types (domain_key, issue_key, issue_label, sort_order)
values
  ('street_signs', 'damaged', 'Damaged', 10),
  ('street_signs', 'blocked', 'Blocked / Obstructed', 20),
  ('street_signs', 'missing', 'Missing', 30),
  ('street_signs', 'faded', 'Faded / Unreadable', 40),
  ('water_drain_issues', 'clogged', 'Clogged', 10),
  ('water_drain_issues', 'standing_water', 'Standing Water', 20),
  ('water_drain_issues', 'flooding', 'Flooding', 30),
  ('water_drain_issues', 'erosion', 'Erosion / Washout', 40)
on conflict (domain_key, issue_key) do update
set
  issue_label = excluded.issue_label,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into public.tenant_domain_assignments (
  tenant_key,
  domain_key,
  active,
  visibility,
  notification_email,
  organization_monitored_repairs,
  billing_status,
  billing_model,
  billing_amount,
  billing_notes,
  activated_at,
  activated_by,
  created_by,
  updated_by
)
select
  t.tenant_key,
  dd.key,
  true,
  dd.default_visibility,
  case
    when dd.key = 'potholes' then nullif(trim(t.notification_email_potholes), '')
    when dd.key = 'water_drain_issues' then nullif(trim(t.notification_email_water_drain), '')
    else null
  end,
  dd.default_organization_monitored_repairs,
  'not_applicable',
  'included',
  0,
  null,
  now(),
  null,
  null,
  null
from public.tenants t
cross join public.domain_definitions dd
where dd.status = 'active'
on conflict (tenant_key, domain_key) do update
set
  notification_email = coalesce(public.tenant_domain_assignments.notification_email, excluded.notification_email),
  organization_monitored_repairs = excluded.organization_monitored_repairs,
  updated_at = now();

commit;

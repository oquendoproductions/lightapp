begin;

-- ---------------------------------------------------------------------------
-- Platform control plane v1
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_profiles (
  tenant_key text primary key references public.tenants(tenant_key) on delete cascade,
  organization_type text not null default 'municipality',
  legal_name text,
  display_name text,
  website_url text,
  url_extension text,
  billing_email text,
  timezone text not null default 'America/New_York',
  contact_primary_name text,
  contact_primary_email text,
  contact_primary_phone text,
  contact_technical_name text,
  contact_technical_email text,
  contact_technical_phone text,
  contact_legal_name text,
  contact_legal_email text,
  contact_legal_phone text,
  contract_status text not null default 'pending' check (contract_status in ('pending', 'active', 'paused', 'expired', 'terminated')),
  contract_start_date date,
  contract_end_date date,
  renewal_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_map_features (
  tenant_key text primary key references public.tenants(tenant_key) on delete cascade,
  show_boundary_border boolean not null default true,
  shade_outside_boundary boolean not null default true,
  outside_shade_opacity numeric(4,2) not null default 0.42 check (outside_shade_opacity >= 0 and outside_shade_opacity <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_files (
  id bigint generated always as identity primary key,
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  file_category text not null check (file_category in ('contract', 'asset_coordinates', 'other')),
  file_name text not null,
  storage_bucket text not null default 'tenant-files',
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists tenant_files_tenant_uploaded_idx
  on public.tenant_files (tenant_key, uploaded_at desc);

create table if not exists public.tenant_audit_log (
  id bigint generated always as identity primary key,
  tenant_key text references public.tenants(tenant_key) on delete set null,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tenant_audit_log_created_idx
  on public.tenant_audit_log (created_at desc);

create index if not exists tenant_audit_log_tenant_created_idx
  on public.tenant_audit_log (tenant_key, created_at desc);

create or replace function public.touch_platform_control_plane_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_tenant_profiles_updated_at on public.tenant_profiles;
create trigger trg_tenant_profiles_updated_at
before update on public.tenant_profiles
for each row
execute function public.touch_platform_control_plane_updated_at();

drop trigger if exists trg_tenant_map_features_updated_at on public.tenant_map_features;
create trigger trg_tenant_map_features_updated_at
before update on public.tenant_map_features
for each row
execute function public.touch_platform_control_plane_updated_at();

alter table public.tenant_profiles enable row level security;
alter table public.tenant_map_features enable row level security;
alter table public.tenant_files enable row level security;
alter table public.tenant_audit_log enable row level security;

drop policy if exists tenant_profiles_select_platform_admin on public.tenant_profiles;
create policy tenant_profiles_select_platform_admin
on public.tenant_profiles
for select
to authenticated
using (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_profiles_manage_platform_admin on public.tenant_profiles;
create policy tenant_profiles_manage_platform_admin
on public.tenant_profiles
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_map_features_select_request_tenant on public.tenant_map_features;
create policy tenant_map_features_select_request_tenant
on public.tenant_map_features
for select
to anon, authenticated
using (tenant_key = public.request_tenant_key());

drop policy if exists tenant_map_features_manage_platform_admin on public.tenant_map_features;
create policy tenant_map_features_manage_platform_admin
on public.tenant_map_features
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_files_select_platform_admin on public.tenant_files;
create policy tenant_files_select_platform_admin
on public.tenant_files
for select
to authenticated
using (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_files_manage_platform_admin on public.tenant_files;
create policy tenant_files_manage_platform_admin
on public.tenant_files
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_audit_log_select_platform_admin on public.tenant_audit_log;
create policy tenant_audit_log_select_platform_admin
on public.tenant_audit_log
for select
to authenticated
using (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_audit_log_insert_platform_admin on public.tenant_audit_log;
create policy tenant_audit_log_insert_platform_admin
on public.tenant_audit_log
for insert
to authenticated
with check (public.is_platform_admin(auth.uid()));

insert into public.tenant_map_features (tenant_key)
select t.tenant_key
from public.tenants t
on conflict (tenant_key) do nothing;

insert into public.tenant_profiles (
  tenant_key,
  legal_name,
  display_name,
  url_extension,
  billing_email,
  contact_primary_email
)
select
  t.tenant_key,
  t.name,
  t.name,
  t.tenant_key,
  coalesce(nullif(trim(t.notification_email_potholes), ''), nullif(trim(t.notification_email_water_drain), '')),
  coalesce(nullif(trim(t.notification_email_potholes), ''), nullif(trim(t.notification_email_water_drain), ''))
from public.tenants t
on conflict (tenant_key) do update
set
  display_name = coalesce(excluded.display_name, public.tenant_profiles.display_name),
  url_extension = coalesce(excluded.url_extension, public.tenant_profiles.url_extension),
  billing_email = coalesce(excluded.billing_email, public.tenant_profiles.billing_email),
  contact_primary_email = coalesce(excluded.contact_primary_email, public.tenant_profiles.contact_primary_email),
  updated_at = now();

insert into public.tenant_visibility_config (tenant_key, domain, visibility)
select t.tenant_key, d.domain, 'public'
from public.tenants t
cross join (
  values
    ('streetlights'::public.incident_domain),
    ('street_signs'::public.incident_domain),
    ('potholes'::public.incident_domain),
    ('water_drain_issues'::public.incident_domain),
    ('power_outage'::public.incident_domain),
    ('water_main'::public.incident_domain)
) as d(domain)
on conflict (tenant_key, domain) do nothing;

insert into storage.buckets (id, name, public)
values ('tenant-files', 'tenant-files', false)
on conflict (id) do nothing;

drop policy if exists tenant_files_platform_select on storage.objects;
create policy tenant_files_platform_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tenant-files'
  and public.is_platform_admin(auth.uid())
);

drop policy if exists tenant_files_platform_insert on storage.objects;
create policy tenant_files_platform_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tenant-files'
  and public.is_platform_admin(auth.uid())
);

drop policy if exists tenant_files_platform_update on storage.objects;
create policy tenant_files_platform_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tenant-files'
  and public.is_platform_admin(auth.uid())
)
with check (
  bucket_id = 'tenant-files'
  and public.is_platform_admin(auth.uid())
);

drop policy if exists tenant_files_platform_delete on storage.objects;
create policy tenant_files_platform_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tenant-files'
  and public.is_platform_admin(auth.uid())
);

commit;

begin;

create table if not exists public.tenant_domain_configs (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  domain public.incident_domain not null,
  domain_type text not null default 'incident_driven'
    check (domain_type in ('asset_backed', 'incident_driven')),
  notification_email text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (tenant_key, domain)
);

drop trigger if exists trg_tenant_domain_configs_updated_at on public.tenant_domain_configs;
create trigger trg_tenant_domain_configs_updated_at
before update on public.tenant_domain_configs
for each row
execute function public.touch_platform_control_plane_updated_at();

alter table public.tenant_domain_configs enable row level security;

grant select, insert, update, delete on public.tenant_domain_configs to authenticated;

drop policy if exists tenant_domain_configs_select on public.tenant_domain_configs;
create policy tenant_domain_configs_select
on public.tenant_domain_configs
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.access')
  or public.has_platform_permission(auth.uid(), 'domains.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
);

drop policy if exists tenant_domain_configs_manage on public.tenant_domain_configs;
create policy tenant_domain_configs_manage
on public.tenant_domain_configs
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
);

insert into public.tenant_domain_configs (
  tenant_key,
  domain,
  domain_type,
  notification_email,
  updated_by
)
select
  t.tenant_key,
  seeded.domain,
  seeded.domain_type,
  case
    when seeded.domain = 'potholes'::public.incident_domain then nullif(trim(t.notification_email_potholes), '')
    when seeded.domain = 'water_drain_issues'::public.incident_domain then nullif(trim(t.notification_email_water_drain), '')
    else null
  end,
  null
from public.tenants t
cross join (
  values
    ('streetlights'::public.incident_domain, 'asset_backed'),
    ('street_signs'::public.incident_domain, 'asset_backed'),
    ('potholes'::public.incident_domain, 'incident_driven'),
    ('water_drain_issues'::public.incident_domain, 'incident_driven'),
    ('power_outage'::public.incident_domain, 'incident_driven'),
    ('water_main'::public.incident_domain, 'incident_driven')
) as seeded(domain, domain_type)
on conflict (tenant_key, domain) do update
set
  domain_type = excluded.domain_type,
  notification_email = coalesce(public.tenant_domain_configs.notification_email, excluded.notification_email);

update public.tenant_files
set asset_subtype = 'streetlights'
where file_category = 'asset_coordinates'
  and coalesce(nullif(trim(asset_subtype), ''), '') = '';

commit;

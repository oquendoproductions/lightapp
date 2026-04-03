begin;

insert into public.tenant_permissions_catalog (permission_key, module_key, action_key, label, sort_order)
values
  ('security.access', 'security', 'access', 'Security access', 70),
  ('security.edit', 'security', 'edit', 'Security edit', 71)
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
  on tpc.permission_key in ('security.access', 'security.edit')
on conflict (tenant_key, role, permission_key) do update
set
  allowed = excluded.allowed;

create table if not exists public.tenant_user_security_profiles (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_hash text,
  pin_enabled boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_key, user_id)
);

create table if not exists public.tenant_security_settings (
  tenant_key text primary key references public.tenants(tenant_key) on delete cascade,
  require_pin_for_account_changes boolean not null default false,
  require_pin_for_report_state_changes boolean not null default false,
  require_pin_for_organization_info_changes boolean not null default false,
  require_pin_for_contact_changes boolean not null default false,
  require_pin_for_organization_user_changes boolean not null default false,
  require_pin_for_organization_role_changes boolean not null default false,
  require_pin_for_domain_settings_changes boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tenant_user_security_profiles_updated_at on public.tenant_user_security_profiles;
create trigger trg_tenant_user_security_profiles_updated_at
before update on public.tenant_user_security_profiles
for each row
execute function public.touch_rbac_updated_at();

drop trigger if exists trg_tenant_security_settings_updated_at on public.tenant_security_settings;
create trigger trg_tenant_security_settings_updated_at
before update on public.tenant_security_settings
for each row
execute function public.touch_rbac_updated_at();

insert into public.tenant_security_settings (tenant_key)
select tenant_key
from public.tenants
on conflict (tenant_key) do nothing;

grant select, insert, update on public.tenant_user_security_profiles to authenticated;
grant select, insert, update on public.tenant_security_settings to authenticated;

alter table public.tenant_user_security_profiles enable row level security;
alter table public.tenant_security_settings enable row level security;

drop policy if exists tenant_user_security_profiles_select_self on public.tenant_user_security_profiles;
create policy tenant_user_security_profiles_select_self
on public.tenant_user_security_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists tenant_user_security_profiles_insert_self on public.tenant_user_security_profiles;
create policy tenant_user_security_profiles_insert_self
on public.tenant_user_security_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists tenant_user_security_profiles_update_self on public.tenant_user_security_profiles;
create policy tenant_user_security_profiles_update_self
on public.tenant_user_security_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists tenant_security_settings_select_scoped on public.tenant_security_settings;
create policy tenant_security_settings_select_scoped
on public.tenant_security_settings
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_tenant_admin(auth.uid(), tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'security.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'security.edit')
);

drop policy if exists tenant_security_settings_insert_scoped on public.tenant_security_settings;
create policy tenant_security_settings_insert_scoped
on public.tenant_security_settings
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.is_tenant_admin(auth.uid(), tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'security.edit')
);

drop policy if exists tenant_security_settings_update_scoped on public.tenant_security_settings;
create policy tenant_security_settings_update_scoped
on public.tenant_security_settings
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_tenant_admin(auth.uid(), tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'security.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.is_tenant_admin(auth.uid(), tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'security.edit')
);

commit;

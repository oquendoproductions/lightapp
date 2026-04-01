begin;

-- ---------------------------------------------------------------------------
-- Phase 3 RBAC: platform role catalog + permissions matrix
-- ---------------------------------------------------------------------------

create table if not exists public.platform_permissions_catalog (
  permission_key text primary key,
  module_key text not null,
  action_key text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint platform_permissions_catalog_action_check
    check (action_key in ('access', 'edit', 'delete'))
);

create table if not exists public.platform_role_definitions (
  role text primary key,
  role_label text not null,
  is_system boolean not null default false,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_role_definitions_role_check
    check (role ~ '^[a-z][a-z0-9_]{1,39}$')
);

create table if not exists public.platform_role_permissions (
  role text not null,
  permission_key text not null references public.platform_permissions_catalog(permission_key) on delete cascade,
  allowed boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, permission_key),
  constraint platform_role_permissions_role_fkey
    foreign key (role)
    references public.platform_role_definitions(role)
    on delete cascade
);

create index if not exists platform_role_definitions_active_idx
  on public.platform_role_definitions (active, role);

create index if not exists platform_role_permissions_role_idx
  on public.platform_role_permissions (role, allowed, permission_key);

insert into public.platform_permissions_catalog (permission_key, module_key, action_key, label, sort_order)
values
  ('account.access', 'account', 'access', 'Account access', 10),
  ('account.edit', 'account', 'edit', 'Account edit', 11),
  ('account.delete', 'account', 'delete', 'Account delete', 12),

  ('organizations.access', 'organizations', 'access', 'Organizations access', 20),
  ('organizations.edit', 'organizations', 'edit', 'Organizations edit', 21),
  ('organizations.delete', 'organizations', 'delete', 'Organizations delete', 22),

  ('leads.access', 'leads', 'access', 'Leads access', 30),
  ('leads.edit', 'leads', 'edit', 'Leads edit', 31),
  ('leads.delete', 'leads', 'delete', 'Leads delete', 32),

  ('users.access', 'users', 'access', 'Users access', 40),
  ('users.edit', 'users', 'edit', 'Users edit', 41),
  ('users.delete', 'users', 'delete', 'Users delete', 42),

  ('roles.access', 'roles', 'access', 'Roles access', 50),
  ('roles.edit', 'roles', 'edit', 'Roles edit', 51),
  ('roles.delete', 'roles', 'delete', 'Roles delete', 52),

  ('security.access', 'security', 'access', 'Security access', 60),
  ('security.edit', 'security', 'edit', 'Security edit', 61),
  ('security.delete', 'security', 'delete', 'Security delete', 62),

  ('reports.access', 'reports', 'access', 'Reports access', 70),
  ('reports.edit', 'reports', 'edit', 'Reports edit', 71),
  ('reports.delete', 'reports', 'delete', 'Reports delete', 72),

  ('finance.access', 'finance', 'access', 'Finance access', 80),
  ('finance.edit', 'finance', 'edit', 'Finance edit', 81),
  ('finance.delete', 'finance', 'delete', 'Finance delete', 82),

  ('domains.access', 'domains', 'access', 'Domains access', 90),
  ('domains.edit', 'domains', 'edit', 'Domains edit', 91),
  ('domains.delete', 'domains', 'delete', 'Domains delete', 92),

  ('files.access', 'files', 'access', 'Files access', 100),
  ('files.edit', 'files', 'edit', 'Files edit', 101),
  ('files.delete', 'files', 'delete', 'Files delete', 102),

  ('audit.access', 'audit', 'access', 'Audit access', 110),
  ('audit.edit', 'audit', 'edit', 'Audit edit', 111),
  ('audit.delete', 'audit', 'delete', 'Audit delete', 112)
on conflict (permission_key) do update
set
  module_key = excluded.module_key,
  action_key = excluded.action_key,
  label = excluded.label,
  sort_order = excluded.sort_order;

insert into public.platform_role_definitions (role, role_label, is_system, active)
values
  ('platform_owner', 'Platform Owner', true, true),
  ('platform_staff', 'Platform Staff', true, true)
on conflict (role) do update
set
  role_label = excluded.role_label,
  is_system = true,
  active = true;

insert into public.platform_role_definitions (role, role_label, is_system, active)
select
  lower(trim(pur.role)) as role,
  initcap(replace(lower(trim(pur.role)), '_', ' ')) as role_label,
  false,
  true
from public.platform_user_roles pur
where nullif(lower(trim(pur.role)), '') is not null
on conflict (role) do nothing;

alter table public.platform_user_roles
  drop constraint if exists platform_user_roles_role_check;

alter table public.platform_user_roles
  drop constraint if exists platform_user_roles_role_fkey;

alter table public.platform_user_roles
  add constraint platform_user_roles_role_fkey
  foreign key (role)
  references public.platform_role_definitions(role)
  on delete restrict;

insert into public.platform_role_permissions (role, permission_key, allowed)
select
  prd.role,
  ppc.permission_key,
  case
    when prd.role = 'platform_owner' then true
    when prd.role = 'platform_staff' and ppc.permission_key in (
      'account.access',
      'leads.access',
      'leads.edit',
      'organizations.access',
      'reports.access',
      'domains.access',
      'domains.edit',
      'files.access',
      'files.edit',
      'audit.access'
    ) then true
    else false
  end as allowed
from public.platform_role_definitions prd
cross join public.platform_permissions_catalog ppc
on conflict (role, permission_key) do update
set
  allowed = case
    when excluded.role = 'platform_owner' then true
    when excluded.role = 'platform_staff' and excluded.permission_key in (
      'account.access',
      'leads.access',
      'leads.edit',
      'organizations.access',
      'reports.access',
      'domains.access',
      'domains.edit',
      'files.access',
      'files.edit',
      'audit.access'
    ) then true
    else public.platform_role_permissions.allowed
  end;

create or replace function public.has_platform_role(uid uuid, role_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_user_roles pur
    join public.platform_role_definitions prd
      on prd.role = pur.role
     and prd.active = true
    where pur.user_id = uid
      and pur.role = lower(trim(coalesce(role_name, '')))
      and pur.status = 'active'
  );
$$;

create or replace function public.has_any_platform_role(uid uuid, role_names text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_user_roles pur
    join public.platform_role_definitions prd
      on prd.role = pur.role
     and prd.active = true
    where pur.user_id = uid
      and pur.status = 'active'
      and pur.role = any (
        select lower(trim(x))
        from unnest(coalesce(role_names, array[]::text[])) as x
      )
  );
$$;

create or replace function public.has_platform_permission(uid uuid, permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with normalized_permission as (
    select lower(trim(coalesce(permission_name, ''))) as permission_key
  )
  select
    exists (
      select 1
      from public.admins a
      where a.user_id = uid
    )
    or exists (
      select 1
      from public.platform_user_roles pur
      join public.platform_role_definitions prd
        on prd.role = pur.role
       and prd.active = true
      join public.platform_role_permissions prp
        on prp.role = pur.role
       and prp.allowed = true
      join normalized_permission np
        on np.permission_key = prp.permission_key
      where pur.user_id = uid
        and pur.status = 'active'
    );
$$;

create or replace function public.is_platform_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.admins a
      where a.user_id = uid
    )
    or exists (
      select 1
      from public.platform_user_roles pur
      where pur.user_id = uid
        and pur.role = 'platform_owner'
        and pur.status = 'active'
    );
$$;

drop trigger if exists trg_platform_role_definitions_updated_at on public.platform_role_definitions;
create trigger trg_platform_role_definitions_updated_at
before update on public.platform_role_definitions
for each row
execute function public.touch_rbac_updated_at();

drop trigger if exists trg_platform_role_permissions_updated_at on public.platform_role_permissions;
create trigger trg_platform_role_permissions_updated_at
before update on public.platform_role_permissions
for each row
execute function public.touch_rbac_updated_at();

grant select on public.platform_permissions_catalog to authenticated;
grant select on public.platform_role_definitions to authenticated;
grant select on public.platform_role_permissions to authenticated;
grant insert, update, delete on public.platform_role_definitions to authenticated;
grant insert, update, delete on public.platform_role_permissions to authenticated;

alter table public.platform_permissions_catalog enable row level security;
alter table public.platform_role_definitions enable row level security;
alter table public.platform_role_permissions enable row level security;

drop policy if exists platform_permissions_catalog_read_authenticated on public.platform_permissions_catalog;
create policy platform_permissions_catalog_read_authenticated
on public.platform_permissions_catalog
for select
to authenticated
using (true);

drop policy if exists platform_role_definitions_select_scoped on public.platform_role_definitions;
create policy platform_role_definitions_select_scoped
on public.platform_role_definitions
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.access')
  or public.has_platform_permission(auth.uid(), 'users.access')
);

drop policy if exists platform_role_definitions_insert_scoped on public.platform_role_definitions;
create policy platform_role_definitions_insert_scoped
on public.platform_role_definitions
for insert
to authenticated
with check (public.has_platform_permission(auth.uid(), 'roles.edit'));

drop policy if exists platform_role_definitions_update_scoped on public.platform_role_definitions;
create policy platform_role_definitions_update_scoped
on public.platform_role_definitions
for update
to authenticated
using (public.has_platform_permission(auth.uid(), 'roles.edit'))
with check (public.has_platform_permission(auth.uid(), 'roles.edit'));

drop policy if exists platform_role_definitions_delete_scoped on public.platform_role_definitions;
create policy platform_role_definitions_delete_scoped
on public.platform_role_definitions
for delete
to authenticated
using (public.has_platform_permission(auth.uid(), 'roles.delete'));

drop policy if exists platform_role_permissions_select_scoped on public.platform_role_permissions;
create policy platform_role_permissions_select_scoped
on public.platform_role_permissions
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.access')
  or public.has_platform_permission(auth.uid(), 'users.access')
);

drop policy if exists platform_role_permissions_insert_scoped on public.platform_role_permissions;
create policy platform_role_permissions_insert_scoped
on public.platform_role_permissions
for insert
to authenticated
with check (public.has_platform_permission(auth.uid(), 'roles.edit'));

drop policy if exists platform_role_permissions_update_scoped on public.platform_role_permissions;
create policy platform_role_permissions_update_scoped
on public.platform_role_permissions
for update
to authenticated
using (public.has_platform_permission(auth.uid(), 'roles.edit'))
with check (public.has_platform_permission(auth.uid(), 'roles.edit'));

drop policy if exists platform_role_permissions_delete_scoped on public.platform_role_permissions;
create policy platform_role_permissions_delete_scoped
on public.platform_role_permissions
for delete
to authenticated
using (public.has_platform_permission(auth.uid(), 'roles.delete'));

drop policy if exists platform_user_roles_select_self_or_owner on public.platform_user_roles;
drop policy if exists platform_user_roles_manage_owner on public.platform_user_roles;
drop policy if exists platform_user_roles_select_scoped on public.platform_user_roles;
create policy platform_user_roles_select_scoped
on public.platform_user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'users.access')
);

drop policy if exists platform_user_roles_insert_scoped on public.platform_user_roles;
create policy platform_user_roles_insert_scoped
on public.platform_user_roles
for insert
to authenticated
with check (
  public.has_platform_permission(auth.uid(), 'users.edit')
  and status in ('active', 'inactive')
  and exists (
    select 1
    from public.platform_role_definitions prd
    where prd.role = platform_user_roles.role
      and prd.active = true
  )
);

drop policy if exists platform_user_roles_update_scoped on public.platform_user_roles;
create policy platform_user_roles_update_scoped
on public.platform_user_roles
for update
to authenticated
using (public.has_platform_permission(auth.uid(), 'users.edit'))
with check (
  public.has_platform_permission(auth.uid(), 'users.edit')
  and status in ('active', 'inactive')
  and exists (
    select 1
    from public.platform_role_definitions prd
    where prd.role = platform_user_roles.role
      and prd.active = true
  )
);

drop policy if exists platform_user_roles_delete_scoped on public.platform_user_roles;
create policy platform_user_roles_delete_scoped
on public.platform_user_roles
for delete
to authenticated
using (public.has_platform_permission(auth.uid(), 'users.delete'));

-- ---------------------------------------------------------------------------
-- Extend PCP-facing policies to support permission-based platform roles.
-- ---------------------------------------------------------------------------

drop policy if exists tenants_manage_platform_admin on public.tenants;
create policy tenants_insert_platform_permissions
on public.tenants
for insert
to authenticated
with check (public.has_platform_permission(auth.uid(), 'organizations.edit'));

create policy tenants_update_platform_permissions
on public.tenants
for update
to authenticated
using (public.has_platform_permission(auth.uid(), 'organizations.edit'))
with check (public.has_platform_permission(auth.uid(), 'organizations.edit'));

create policy tenants_delete_platform_permissions
on public.tenants
for delete
to authenticated
using (public.has_platform_permission(auth.uid(), 'organizations.delete'));

create policy tenants_select_platform_permissions
on public.tenants
for select
to authenticated
using (
  public.has_platform_permission(auth.uid(), 'organizations.access')
  or public.has_platform_permission(auth.uid(), 'organizations.edit')
  or public.has_platform_permission(auth.uid(), 'organizations.delete')
);

drop policy if exists tenant_profiles_select_platform_admin on public.tenant_profiles;
create policy tenant_profiles_select_platform_permissions
on public.tenant_profiles
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'organizations.access')
);

drop policy if exists tenant_profiles_manage_platform_admin on public.tenant_profiles;
create policy tenant_profiles_manage_platform_permissions
on public.tenant_profiles
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'organizations.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'organizations.edit')
);

drop policy if exists tenant_map_features_manage_platform_admin on public.tenant_map_features;
create policy tenant_map_features_select_platform_permissions
on public.tenant_map_features
for select
to authenticated
using (
  tenant_key = public.request_tenant_key()
  or public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.access')
);

create policy tenant_map_features_manage_platform_permissions
on public.tenant_map_features
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

drop policy if exists tenant_files_select_platform_admin on public.tenant_files;
create policy tenant_files_select_platform_permissions
on public.tenant_files
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'files.access')
);

drop policy if exists tenant_files_manage_platform_admin on public.tenant_files;
create policy tenant_files_insert_platform_permissions
on public.tenant_files
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'files.edit')
);

create policy tenant_files_update_platform_permissions
on public.tenant_files
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'files.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'files.edit')
);

create policy tenant_files_delete_platform_permissions
on public.tenant_files
for delete
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'files.delete')
);

drop policy if exists tenant_audit_log_select_platform_admin on public.tenant_audit_log;
create policy tenant_audit_log_select_platform_permissions
on public.tenant_audit_log
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'audit.access')
);

drop policy if exists tenant_role_definitions_select_scoped on public.tenant_role_definitions;
create policy tenant_role_definitions_select_scoped
on public.tenant_role_definitions
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.access')
  or public.has_platform_permission(auth.uid(), 'users.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'roles.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.access')
);

drop policy if exists tenant_role_definitions_manage_owner on public.tenant_role_definitions;
create policy tenant_role_definitions_insert_platform_permissions
on public.tenant_role_definitions
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.edit')
);

create policy tenant_role_definitions_update_platform_permissions
on public.tenant_role_definitions
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.edit')
);

create policy tenant_role_definitions_delete_platform_permissions
on public.tenant_role_definitions
for delete
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.delete')
);

drop policy if exists tenant_role_permissions_select_scoped on public.tenant_role_permissions;
create policy tenant_role_permissions_select_scoped
on public.tenant_role_permissions
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.access')
  or public.has_platform_permission(auth.uid(), 'users.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'roles.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.access')
);

drop policy if exists tenant_role_permissions_manage_owner on public.tenant_role_permissions;
create policy tenant_role_permissions_insert_platform_permissions
on public.tenant_role_permissions
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.edit')
);

create policy tenant_role_permissions_update_platform_permissions
on public.tenant_role_permissions
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.edit')
);

create policy tenant_role_permissions_delete_platform_permissions
on public.tenant_role_permissions
for delete
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'roles.delete')
);

drop policy if exists tenant_user_roles_select_scoped on public.tenant_user_roles;
create policy tenant_user_roles_select_scoped
on public.tenant_user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'users.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.access')
);

drop policy if exists tenant_user_roles_tenant_admin_insert_employee on public.tenant_user_roles;
create policy tenant_user_roles_tenant_admin_insert_employee
on public.tenant_user_roles
for insert
to authenticated
with check (
  (
    public.is_platform_admin(auth.uid())
    or public.has_platform_permission(auth.uid(), 'users.edit')
    or public.has_tenant_permission(auth.uid(), tenant_key, 'users.edit')
  )
  and exists (
    select 1
    from public.tenant_role_definitions trd
    where trd.tenant_key = tenant_user_roles.tenant_key
      and trd.role = tenant_user_roles.role
      and trd.active = true
      and (public.is_platform_admin(auth.uid()) or trd.is_system = false or trd.role = 'tenant_employee')
  )
  and status in ('active', 'inactive')
);

drop policy if exists tenant_user_roles_tenant_admin_update_employee on public.tenant_user_roles;
create policy tenant_user_roles_tenant_admin_update_employee
on public.tenant_user_roles
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'users.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.edit')
)
with check (
  (
    public.is_platform_admin(auth.uid())
    or public.has_platform_permission(auth.uid(), 'users.edit')
    or public.has_tenant_permission(auth.uid(), tenant_key, 'users.edit')
  )
  and exists (
    select 1
    from public.tenant_role_definitions trd
    where trd.tenant_key = tenant_user_roles.tenant_key
      and trd.role = tenant_user_roles.role
      and trd.active = true
      and (public.is_platform_admin(auth.uid()) or trd.is_system = false or trd.role = 'tenant_employee')
  )
  and status in ('active', 'inactive')
);

drop policy if exists tenant_user_roles_tenant_admin_delete_employee on public.tenant_user_roles;
create policy tenant_user_roles_tenant_admin_delete_employee
on public.tenant_user_roles
for delete
to authenticated
using (
  (
    public.is_platform_admin(auth.uid())
    or public.has_platform_permission(auth.uid(), 'users.delete')
    or public.has_tenant_permission(auth.uid(), tenant_key, 'users.delete')
  )
  and exists (
    select 1
    from public.tenant_role_definitions trd
    where trd.tenant_key = tenant_user_roles.tenant_key
      and trd.role = tenant_user_roles.role
      and (public.is_platform_admin(auth.uid()) or trd.is_system = false or trd.role = 'tenant_employee')
  )
);

drop policy if exists client_leads_platform_select on public.client_leads;
create policy client_leads_platform_select
  on public.client_leads
  for select
  to authenticated
  using (
    public.is_platform_admin(auth.uid())
    or public.has_platform_permission(auth.uid(), 'leads.access')
  );

drop policy if exists client_leads_platform_update on public.client_leads;
create policy client_leads_platform_update
  on public.client_leads
  for update
  to authenticated
  using (
    public.is_platform_admin(auth.uid())
    or public.has_platform_permission(auth.uid(), 'leads.edit')
  )
  with check (
    public.is_platform_admin(auth.uid())
    or public.has_platform_permission(auth.uid(), 'leads.edit')
  );

drop policy if exists tenant_visibility_config_tenant_scope_restrictive on public.tenant_visibility_config;
create policy tenant_visibility_config_tenant_scope_restrictive
on public.tenant_visibility_config
as restrictive
for all
to public
using (
  tenant_key = public.request_tenant_key()
  or public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.access')
  or public.has_platform_permission(auth.uid(), 'domains.edit')
)
with check (
  tenant_key = public.request_tenant_key()
  or public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'domains.edit')
);

drop policy if exists app_config_manage_platform_admin on public.app_config;
create policy app_config_manage_platform_admin
on public.app_config
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

commit;

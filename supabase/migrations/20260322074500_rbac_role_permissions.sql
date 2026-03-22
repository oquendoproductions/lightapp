begin;

-- ---------------------------------------------------------------------------
-- Phase 2 RBAC: tenant role catalog + permissions matrix
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_permissions_catalog (
  permission_key text primary key,
  module_key text not null,
  action_key text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tenant_permissions_catalog_action_check
    check (action_key in ('access', 'edit', 'delete'))
);

create table if not exists public.tenant_role_definitions (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  role text not null,
  role_label text not null,
  is_system boolean not null default false,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_key, role),
  constraint tenant_role_definitions_role_check
    check (role ~ '^[a-z][a-z0-9_]{1,39}$')
);

create table if not exists public.tenant_role_permissions (
  tenant_key text not null,
  role text not null,
  permission_key text not null references public.tenant_permissions_catalog(permission_key) on delete cascade,
  allowed boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_key, role, permission_key),
  constraint tenant_role_permissions_role_fkey
    foreign key (tenant_key, role)
    references public.tenant_role_definitions(tenant_key, role)
    on delete cascade
);

create index if not exists tenant_role_definitions_tenant_active_idx
  on public.tenant_role_definitions (tenant_key, active, role);

create index if not exists tenant_role_permissions_tenant_role_idx
  on public.tenant_role_permissions (tenant_key, role, allowed, permission_key);

-- Seed permission catalog (module/action matrix for roles dashboard).
insert into public.tenant_permissions_catalog (permission_key, module_key, action_key, label, sort_order)
values
  ('reports.access', 'reports', 'access', 'Reports access', 10),
  ('reports.edit', 'reports', 'edit', 'Reports edit', 11),
  ('reports.delete', 'reports', 'delete', 'Reports delete', 12),

  ('users.access', 'users', 'access', 'Users access', 20),
  ('users.edit', 'users', 'edit', 'Users edit', 21),
  ('users.delete', 'users', 'delete', 'Users delete', 22),

  ('domains.access', 'domains', 'access', 'Domains access', 30),
  ('domains.edit', 'domains', 'edit', 'Domains edit', 31),
  ('domains.delete', 'domains', 'delete', 'Domains delete', 32),

  ('files.access', 'files', 'access', 'Files access', 40),
  ('files.edit', 'files', 'edit', 'Files edit', 41),
  ('files.delete', 'files', 'delete', 'Files delete', 42),

  ('audit.access', 'audit', 'access', 'Audit access', 50),
  ('audit.edit', 'audit', 'edit', 'Audit edit', 51),
  ('audit.delete', 'audit', 'delete', 'Audit delete', 52),

  ('roles.access', 'roles', 'access', 'Roles access', 60),
  ('roles.edit', 'roles', 'edit', 'Roles edit', 61),
  ('roles.delete', 'roles', 'delete', 'Roles delete', 62)
on conflict (permission_key) do update
set
  module_key = excluded.module_key,
  action_key = excluded.action_key,
  label = excluded.label,
  sort_order = excluded.sort_order;

-- Ensure default role definitions exist for all tenants.
insert into public.tenant_role_definitions (tenant_key, role, role_label, is_system, active)
select t.tenant_key, seed.role, seed.role_label, true, true
from public.tenants t
cross join (
  values
    ('tenant_admin', 'Tenant Admin'),
    ('tenant_employee', 'Tenant Employee')
) as seed(role, role_label)
on conflict (tenant_key, role) do update
set
  role_label = excluded.role_label,
  is_system = true,
  active = true;

-- Backfill role definitions from any existing role assignments.
insert into public.tenant_role_definitions (tenant_key, role, role_label, is_system, active)
select
  tur.tenant_key,
  lower(trim(tur.role)) as role,
  initcap(replace(lower(trim(tur.role)), '_', ' ')) as role_label,
  false,
  true
from public.tenant_user_roles tur
where nullif(lower(trim(tur.role)), '') is not null
on conflict (tenant_key, role) do nothing;

-- Widen tenant_user_roles.role to be catalog-driven instead of hard-coded check list.
alter table public.tenant_user_roles
  drop constraint if exists tenant_user_roles_role_check;

alter table public.tenant_user_roles
  drop constraint if exists tenant_user_roles_role_fkey;

alter table public.tenant_user_roles
  add constraint tenant_user_roles_role_fkey
  foreign key (tenant_key, role)
  references public.tenant_role_definitions(tenant_key, role)
  on delete restrict;

-- Seed permission rows for all tenant roles + known permissions.
insert into public.tenant_role_permissions (tenant_key, role, permission_key, allowed)
select
  trd.tenant_key,
  trd.role,
  tpc.permission_key,
  case
    when trd.role = 'tenant_admin' then true
    when trd.role = 'tenant_employee' and tpc.permission_key in ('reports.access', 'audit.access') then true
    else false
  end as allowed
from public.tenant_role_definitions trd
cross join public.tenant_permissions_catalog tpc
on conflict (tenant_key, role, permission_key) do update
set
  allowed = excluded.allowed;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.has_tenant_role(uid uuid, tenant text, role_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with resolved_tenant as (
    select coalesce(nullif(lower(trim(coalesce(tenant, ''))), ''), public.request_tenant_key()) as tenant_key
  )
  select exists (
    select 1
    from public.tenant_user_roles tur
    join public.tenant_role_definitions trd
      on trd.tenant_key = tur.tenant_key
     and trd.role = tur.role
     and trd.active = true
    join resolved_tenant rt on rt.tenant_key = tur.tenant_key
    where tur.user_id = uid
      and tur.role = lower(trim(coalesce(role_name, '')))
      and tur.status = 'active'
  );
$$;

create or replace function public.has_any_tenant_role(uid uuid, tenant text, role_names text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with resolved_tenant as (
    select coalesce(nullif(lower(trim(coalesce(tenant, ''))), ''), public.request_tenant_key()) as tenant_key
  ),
  normalized_roles as (
    select lower(trim(x)) as role_name
    from unnest(coalesce(role_names, array[]::text[])) as x
  )
  select exists (
    select 1
    from public.tenant_user_roles tur
    join public.tenant_role_definitions trd
      on trd.tenant_key = tur.tenant_key
     and trd.role = tur.role
     and trd.active = true
    join resolved_tenant rt on rt.tenant_key = tur.tenant_key
    where tur.user_id = uid
      and tur.status = 'active'
      and tur.role in (select role_name from normalized_roles)
  );
$$;

create or replace function public.has_tenant_permission(uid uuid, tenant text, permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with resolved_tenant as (
    select coalesce(nullif(lower(trim(coalesce(tenant, ''))), ''), public.request_tenant_key()) as tenant_key
  ),
  normalized_permission as (
    select lower(trim(coalesce(permission_name, ''))) as permission_key
  )
  select
    public.is_platform_admin(uid)
    or exists (
      select 1
      from public.tenant_user_roles tur
      join public.tenant_role_definitions trd
        on trd.tenant_key = tur.tenant_key
       and trd.role = tur.role
       and trd.active = true
      join public.tenant_role_permissions trp
        on trp.tenant_key = tur.tenant_key
       and trp.role = tur.role
       and trp.allowed = true
      join resolved_tenant rt on rt.tenant_key = tur.tenant_key
      join normalized_permission np on np.permission_key = trp.permission_key
      where tur.user_id = uid
        and tur.status = 'active'
    )
    or exists (
      select 1
      from public.tenant_admins ta
      join resolved_tenant rt on rt.tenant_key = ta.tenant_key
      join normalized_permission np on np.permission_key in (
        'reports.access', 'reports.edit', 'reports.delete',
        'users.access', 'users.edit', 'users.delete',
        'domains.access', 'domains.edit', 'domains.delete',
        'files.access', 'files.edit', 'files.delete',
        'audit.access', 'audit.edit', 'audit.delete',
        'roles.access', 'roles.edit', 'roles.delete'
      )
      where ta.user_id = uid
    );
$$;

create or replace function public.is_tenant_admin(uid uuid, tenant text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_platform_admin(uid)
    or public.has_tenant_permission(uid, tenant, 'users.edit')
    or public.has_tenant_role(uid, tenant, 'tenant_admin')
    or exists (
      select 1
      from public.tenant_admins ta
      where ta.user_id = uid
        and ta.tenant_key = coalesce(nullif(lower(trim(coalesce(tenant, ''))), ''), public.request_tenant_key())
    );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists trg_tenant_role_definitions_updated_at on public.tenant_role_definitions;
create trigger trg_tenant_role_definitions_updated_at
before update on public.tenant_role_definitions
for each row
execute function public.touch_rbac_updated_at();

drop trigger if exists trg_tenant_role_permissions_updated_at on public.tenant_role_permissions;
create trigger trg_tenant_role_permissions_updated_at
before update on public.tenant_role_permissions
for each row
execute function public.touch_rbac_updated_at();

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

grant select on public.tenant_permissions_catalog to authenticated;
grant select on public.tenant_role_definitions to authenticated;
grant select on public.tenant_role_permissions to authenticated;
grant insert, update, delete on public.tenant_role_definitions to authenticated;
grant insert, update, delete on public.tenant_role_permissions to authenticated;

alter table public.tenant_permissions_catalog enable row level security;
alter table public.tenant_role_definitions enable row level security;
alter table public.tenant_role_permissions enable row level security;

drop policy if exists tenant_permissions_catalog_read_authenticated on public.tenant_permissions_catalog;
create policy tenant_permissions_catalog_read_authenticated
on public.tenant_permissions_catalog
for select
to authenticated
using (true);

drop policy if exists tenant_role_definitions_select_scoped on public.tenant_role_definitions;
create policy tenant_role_definitions_select_scoped
on public.tenant_role_definitions
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_tenant_permission(auth.uid(), tenant_key, 'roles.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.access')
);

drop policy if exists tenant_role_definitions_manage_owner on public.tenant_role_definitions;
create policy tenant_role_definitions_manage_owner
on public.tenant_role_definitions
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_role_permissions_select_scoped on public.tenant_role_permissions;
create policy tenant_role_permissions_select_scoped
on public.tenant_role_permissions
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_tenant_permission(auth.uid(), tenant_key, 'roles.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.access')
);

drop policy if exists tenant_role_permissions_manage_owner on public.tenant_role_permissions;
create policy tenant_role_permissions_manage_owner
on public.tenant_role_permissions
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

-- Update tenant_user_roles policies to support role catalog.
drop policy if exists tenant_user_roles_select_scoped on public.tenant_user_roles;
create policy tenant_user_roles_select_scoped
on public.tenant_user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin(auth.uid())
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.access')
);

drop policy if exists tenant_user_roles_tenant_admin_insert_employee on public.tenant_user_roles;
create policy tenant_user_roles_tenant_admin_insert_employee
on public.tenant_user_roles
for insert
to authenticated
with check (
  public.has_tenant_permission(auth.uid(), tenant_key, 'users.edit')
  and exists (
    select 1
    from public.tenant_role_definitions trd
    where trd.tenant_key = tenant_user_roles.tenant_key
      and trd.role = tenant_user_roles.role
      and trd.active = true
      and trd.is_system = false
  )
  and status in ('active', 'inactive')
);

drop policy if exists tenant_user_roles_tenant_admin_update_employee on public.tenant_user_roles;
create policy tenant_user_roles_tenant_admin_update_employee
on public.tenant_user_roles
for update
to authenticated
using (
  public.has_tenant_permission(auth.uid(), tenant_key, 'users.edit')
)
with check (
  public.has_tenant_permission(auth.uid(), tenant_key, 'users.edit')
  and exists (
    select 1
    from public.tenant_role_definitions trd
    where trd.tenant_key = tenant_user_roles.tenant_key
      and trd.role = tenant_user_roles.role
      and trd.active = true
      and trd.is_system = false
  )
  and status in ('active', 'inactive')
);

drop policy if exists tenant_user_roles_tenant_admin_delete_employee on public.tenant_user_roles;
create policy tenant_user_roles_tenant_admin_delete_employee
on public.tenant_user_roles
for delete
to authenticated
using (
  public.has_tenant_permission(auth.uid(), tenant_key, 'users.delete')
  and exists (
    select 1
    from public.tenant_role_definitions trd
    where trd.tenant_key = tenant_user_roles.tenant_key
      and trd.role = tenant_user_roles.role
      and trd.is_system = false
  )
);

-- Refresh restrictive write policies: now key off reports.edit permission.
do $$
declare
  t text;
  lock_tables text[] := array[
    'light_actions',
    'official_lights',
    'official_signs',
    'fixed_lights'
  ];
begin
  foreach t in array lock_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (public.is_platform_admin(auth.uid()) or public.has_tenant_permission(auth.uid(), tenant_key, ''reports.edit''))',
      t || '_rbac_write_insert',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_update', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (public.is_platform_admin(auth.uid()) or public.has_tenant_permission(auth.uid(), tenant_key, ''reports.edit'')) with check (public.is_platform_admin(auth.uid()) or public.has_tenant_permission(auth.uid(), tenant_key, ''reports.edit''))',
      t || '_rbac_write_update',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_delete', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (public.is_platform_admin(auth.uid()) or public.has_tenant_permission(auth.uid(), tenant_key, ''reports.edit''))',
      t || '_rbac_write_delete',
      t
    );
  end loop;
end
$$;

commit;

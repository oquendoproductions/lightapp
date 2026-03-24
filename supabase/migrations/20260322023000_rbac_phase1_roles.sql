begin;
-- ---------------------------------------------------------------------------
-- Phase 1 RBAC foundation
-- ---------------------------------------------------------------------------

create table if not exists public.platform_user_roles (
  user_id uuid not null,
  role text not null check (role in ('platform_owner', 'platform_staff')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  assigned_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);
create table if not exists public.tenant_user_roles (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('tenant_admin', 'tenant_employee')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  assigned_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_key, user_id, role)
);
create index if not exists platform_user_roles_role_status_idx
  on public.platform_user_roles (role, status, user_id);
create index if not exists tenant_user_roles_tenant_status_idx
  on public.tenant_user_roles (tenant_key, status, role, user_id);
create or replace function public.touch_rbac_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_platform_user_roles_updated_at on public.platform_user_roles;
create trigger trg_platform_user_roles_updated_at
before update on public.platform_user_roles
for each row
execute function public.touch_rbac_updated_at();
drop trigger if exists trg_tenant_user_roles_updated_at on public.tenant_user_roles;
create trigger trg_tenant_user_roles_updated_at
before update on public.tenant_user_roles
for each row
execute function public.touch_rbac_updated_at();
-- Backfill legacy platform admins as platform owners.
insert into public.platform_user_roles (user_id, role, status)
select a.user_id, 'platform_owner', 'active'
from public.admins a
on conflict (user_id, role) do nothing;
-- Backfill legacy tenant admins.
insert into public.tenant_user_roles (tenant_key, user_id, role, status)
select
  ta.tenant_key,
  ta.user_id,
  case
    when lower(trim(coalesce(ta.role, 'municipality_admin'))) in ('municipality_admin', 'tenant_admin')
      then 'tenant_admin'
    else 'tenant_employee'
  end as mapped_role,
  'active'
from public.tenant_admins ta
on conflict (tenant_key, user_id, role) do nothing;
-- ---------------------------------------------------------------------------
-- RBAC helper functions (security-definer)
-- ---------------------------------------------------------------------------

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
    where pur.user_id = uid
      and pur.status = 'active'
      and pur.role = any (
        select lower(trim(x))
        from unnest(coalesce(role_names, array[]::text[])) as x
      )
  );
$$;
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
    join resolved_tenant rt on rt.tenant_key = tur.tenant_key
    where tur.user_id = uid
      and tur.status = 'active'
      and tur.role in (select role_name from normalized_roles)
  );
$$;
-- Compatibility wrappers (existing callers)
create or replace function public.is_platform_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.has_platform_role(uid, 'platform_owner')
    or exists (
      select 1
      from public.admins a
      where a.user_id = uid
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
    or public.has_tenant_role(uid, tenant, 'tenant_admin')
    or exists (
      select 1
      from public.tenant_admins ta
      where ta.user_id = uid
        and ta.tenant_key = coalesce(nullif(lower(trim(coalesce(tenant, ''))), ''), public.request_tenant_key())
    );
$$;
-- ---------------------------------------------------------------------------
-- RLS policies for role tables
-- ---------------------------------------------------------------------------

alter table public.platform_user_roles enable row level security;
alter table public.tenant_user_roles enable row level security;
drop policy if exists platform_user_roles_select_self_or_owner on public.platform_user_roles;
create policy platform_user_roles_select_self_or_owner
on public.platform_user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin(auth.uid())
);
drop policy if exists platform_user_roles_manage_owner on public.platform_user_roles;
create policy platform_user_roles_manage_owner
on public.platform_user_roles
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));
drop policy if exists tenant_user_roles_select_scoped on public.tenant_user_roles;
create policy tenant_user_roles_select_scoped
on public.tenant_user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin(auth.uid())
  or public.has_tenant_role(auth.uid(), tenant_key, 'tenant_admin')
);
drop policy if exists tenant_user_roles_manage_owner on public.tenant_user_roles;
create policy tenant_user_roles_manage_owner
on public.tenant_user_roles
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));
drop policy if exists tenant_user_roles_tenant_admin_insert_employee on public.tenant_user_roles;
create policy tenant_user_roles_tenant_admin_insert_employee
on public.tenant_user_roles
for insert
to authenticated
with check (
  public.has_tenant_role(auth.uid(), tenant_key, 'tenant_admin')
  and role = 'tenant_employee'
  and status in ('active', 'inactive')
);
drop policy if exists tenant_user_roles_tenant_admin_update_employee on public.tenant_user_roles;
create policy tenant_user_roles_tenant_admin_update_employee
on public.tenant_user_roles
for update
to authenticated
using (
  public.has_tenant_role(auth.uid(), tenant_key, 'tenant_admin')
  and role = 'tenant_employee'
)
with check (
  public.has_tenant_role(auth.uid(), tenant_key, 'tenant_admin')
  and role = 'tenant_employee'
  and status in ('active', 'inactive')
);
drop policy if exists tenant_user_roles_tenant_admin_delete_employee on public.tenant_user_roles;
create policy tenant_user_roles_tenant_admin_delete_employee
on public.tenant_user_roles
for delete
to authenticated
using (
  public.has_tenant_role(auth.uid(), tenant_key, 'tenant_admin')
  and role = 'tenant_employee'
);
-- ---------------------------------------------------------------------------
-- Quick lock: privileged write paths must be platform-owner or tenant-admin
-- ---------------------------------------------------------------------------

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
      'create policy %I on public.%I as restrictive for insert to authenticated with check (public.is_platform_admin(auth.uid()) or public.is_tenant_admin(auth.uid(), tenant_key))',
      t || '_rbac_write_insert',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_update', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (public.is_platform_admin(auth.uid()) or public.is_tenant_admin(auth.uid(), tenant_key)) with check (public.is_platform_admin(auth.uid()) or public.is_tenant_admin(auth.uid(), tenant_key))',
      t || '_rbac_write_update',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_delete', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (public.is_platform_admin(auth.uid()) or public.is_tenant_admin(auth.uid(), tenant_key))',
      t || '_rbac_write_delete',
      t
    );
  end loop;
end
$$;
commit;

begin;

insert into public.tenant_permissions_catalog (permission_key, module_key, action_key, label, sort_order)
values
  ('admin_reports.access', 'admin_reports', 'access', 'Admin reports access', 13),
  ('domain_reports.access', 'domain_reports', 'access', 'Domain reports access', 14)
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
  seeded.permission_key,
  coalesce(base.allowed, false) as allowed
from public.tenant_role_definitions trd
cross join (
  values
    ('admin_reports.access'),
    ('domain_reports.access')
) as seeded(permission_key)
left join public.tenant_role_permissions existing
  on existing.tenant_key = trd.tenant_key
 and existing.role = trd.role
 and existing.permission_key = seeded.permission_key
left join public.tenant_role_permissions base
  on base.tenant_key = trd.tenant_key
 and base.role = trd.role
 and base.permission_key = 'reports.access'
where existing.permission_key is null
on conflict (tenant_key, role, permission_key) do nothing;

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
        'admin_reports.access', 'domain_reports.access',
        'users.access', 'users.edit', 'users.delete',
        'domains.access', 'domains.edit', 'domains.delete',
        'files.access', 'files.edit', 'files.delete',
        'audit.access', 'audit.edit', 'audit.delete',
        'roles.access', 'roles.edit', 'roles.delete'
      )
      where ta.user_id = uid
    );
$$;

create or replace function public.can_access_tenant_admin_reports(p_tenant text default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and (
      public.has_tenant_permission(auth.uid(), p_tenant, 'admin_reports.access')
      or public.has_tenant_permission(auth.uid(), p_tenant, 'reports.access')
    );
$$;

create or replace function public.can_access_tenant_domain_reports(p_tenant text default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and (
      public.can_access_tenant_admin_reports(p_tenant)
      or public.has_tenant_permission(auth.uid(), p_tenant, 'domain_reports.access')
      or public.has_tenant_permission(auth.uid(), p_tenant, 'reports.access')
    );
$$;

grant execute on function public.can_access_tenant_admin_reports(text) to authenticated;
grant execute on function public.can_access_tenant_domain_reports(text) to authenticated;

commit;

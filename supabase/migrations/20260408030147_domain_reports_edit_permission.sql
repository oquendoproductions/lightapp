begin;

insert into public.tenant_permissions_catalog (permission_key, module_key, action_key, label, sort_order)
values
  ('domain_reports.edit', 'domain_reports', 'edit', 'Mark fixed / reopen', 15)
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
  'domain_reports.edit',
  case
    when trd.role = 'tenant_admin' then true
    when exists (
      select 1
      from public.tenant_role_permissions trp
      where trp.tenant_key = trd.tenant_key
        and trp.role = trd.role
        and trp.allowed = true
        and trp.permission_key in ('reports.edit', 'admin_reports.access')
    ) then true
    else false
  end as allowed
from public.tenant_role_definitions trd
on conflict (tenant_key, role, permission_key) do nothing;

create or replace function public.can_edit_tenant_domain_reports(p_tenant text default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and (
      public.has_tenant_permission(auth.uid(), p_tenant, 'domain_reports.edit')
      or public.has_tenant_permission(auth.uid(), p_tenant, 'reports.edit')
      or public.has_tenant_permission(auth.uid(), p_tenant, 'admin_reports.access')
    );
$$;

grant execute on function public.can_edit_tenant_domain_reports(text) to authenticated;

do $$
declare
  t text;
  lock_tables text[] := array[
    'light_actions',
    'official_lights',
    'official_signs',
    'fixed_lights'
  ];
  write_check text := '(' ||
    'public.is_platform_admin(auth.uid()) ' ||
    'or public.has_tenant_permission(auth.uid(), tenant_key, ''reports.edit'') ' ||
    'or public.has_tenant_permission(auth.uid(), tenant_key, ''admin_reports.access'') ' ||
    'or public.has_tenant_permission(auth.uid(), tenant_key, ''domain_reports.edit'')' ||
  ')';
begin
  foreach t in array lock_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check %s',
      t || '_rbac_write_insert',
      t,
      write_check
    );

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_update', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using %s with check %s',
      t || '_rbac_write_update',
      t,
      write_check,
      write_check
    );

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_delete', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using %s',
      t || '_rbac_write_delete',
      t,
      write_check
    );
  end loop;
end
$$;

commit;

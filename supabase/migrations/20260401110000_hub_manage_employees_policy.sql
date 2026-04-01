begin;

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
      and trd.role <> 'tenant_admin'
      and (
        trd.is_system = false
        or trd.role = 'tenant_employee'
      )
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
      and trd.role <> 'tenant_admin'
      and (
        trd.is_system = false
        or trd.role = 'tenant_employee'
      )
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
      and trd.active = true
      and trd.role <> 'tenant_admin'
      and (
        trd.is_system = false
        or trd.role = 'tenant_employee'
      )
  )
);

commit;

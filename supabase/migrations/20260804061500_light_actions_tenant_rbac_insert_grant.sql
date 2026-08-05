-- Tenant report editors must have a permissive INSERT grant.  The previous
-- policy was restrictive, so it only acted as an additional check while the
-- sole permissive insert policy admitted platform admins only.
drop policy if exists light_actions_rbac_write_insert on public.light_actions;

create policy light_actions_rbac_write_insert
on public.light_actions
as permissive
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.has_tenant_permission(auth.uid(), tenant_key, 'reports.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'admin_reports.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domain_reports.edit')
);

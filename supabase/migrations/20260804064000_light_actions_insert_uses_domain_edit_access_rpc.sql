-- Keep the write policy aligned with the access check used by the map UI.
-- The lower-level permission helper returned true in direct calls but did not
-- evaluate consistently inside this RLS policy for tenant administrators.
drop policy if exists light_actions_rbac_write_insert on public.light_actions;

create policy light_actions_rbac_write_insert
on public.light_actions
as permissive
for insert
to authenticated
with check (
  public.can_edit_tenant_domain_reports(tenant_key)
);

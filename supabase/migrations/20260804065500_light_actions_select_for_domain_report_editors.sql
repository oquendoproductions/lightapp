-- Supabase `.insert().select()` uses INSERT ... RETURNING, which also requires
-- a SELECT policy. Tenant editors can write the action but were unable to read
-- the returned row because the only select policy was platform-admin-only.
create policy light_actions_select_domain_report_editors
on public.light_actions
as permissive
for select
to authenticated
using (
  public.can_edit_tenant_domain_reports(tenant_key)
);

begin;

-- Fix platform control-plane access to tenant visibility config.
-- 1) Restore table grants for API roles.
grant select on public.tenant_visibility_config to anon;
grant select, insert, update, delete on public.tenant_visibility_config to authenticated;

-- 2) Preserve tenant boundary while allowing platform admins cross-tenant operations.
drop policy if exists tenant_visibility_config_tenant_scope_restrictive on public.tenant_visibility_config;
create policy tenant_visibility_config_tenant_scope_restrictive
on public.tenant_visibility_config
as restrictive
for all
to public
using (
  tenant_key = public.request_tenant_key()
  or public.is_platform_admin(auth.uid())
)
with check (
  tenant_key = public.request_tenant_key()
  or public.is_platform_admin(auth.uid())
);

commit;

begin;

grant select, insert, update on public.tenant_profiles to authenticated;
grant select, insert, update on public.tenant_map_features to authenticated;

drop policy if exists tenant_profiles_select_location_staff on public.tenant_profiles;
create policy tenant_profiles_select_location_staff
on public.tenant_profiles
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.can_manage_tenant_communications(tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
);

drop policy if exists tenant_profiles_manage_location_staff on public.tenant_profiles;
create policy tenant_profiles_manage_location_staff
on public.tenant_profiles
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.can_manage_tenant_communications(tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.can_manage_tenant_communications(tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
);

drop policy if exists tenant_map_features_manage_location_staff on public.tenant_map_features;
create policy tenant_map_features_manage_location_staff
on public.tenant_map_features
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.can_manage_tenant_communications(tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.can_manage_tenant_communications(tenant_key)
  or public.has_tenant_permission(auth.uid(), tenant_key, 'domains.edit')
);

commit;

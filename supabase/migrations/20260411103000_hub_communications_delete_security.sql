begin;

alter table public.tenant_security_settings
add column if not exists require_pin_for_communications_delete boolean not null default false;

create or replace function public.can_delete_tenant_communications(p_tenant text default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and (
      public.is_platform_admin(auth.uid())
      or public.is_tenant_admin(auth.uid(), p_tenant)
      or public.has_tenant_permission(auth.uid(), p_tenant, 'communications.delete')
    );
$$;

grant execute on function public.can_delete_tenant_communications(text) to anon, authenticated;

drop policy if exists municipality_alerts_manage_editor on public.municipality_alerts;

drop policy if exists municipality_alerts_insert_editor on public.municipality_alerts;
create policy municipality_alerts_insert_editor
on public.municipality_alerts
for insert
to authenticated
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists municipality_alerts_update_editor on public.municipality_alerts;
create policy municipality_alerts_update_editor
on public.municipality_alerts
for update
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
)
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists municipality_alerts_delete_editor on public.municipality_alerts;
create policy municipality_alerts_delete_editor
on public.municipality_alerts
for delete
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_delete_tenant_communications(tenant_key)
);

drop policy if exists municipality_events_manage_editor on public.municipality_events;

drop policy if exists municipality_events_insert_editor on public.municipality_events;
create policy municipality_events_insert_editor
on public.municipality_events
for insert
to authenticated
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists municipality_events_update_editor on public.municipality_events;
create policy municipality_events_update_editor
on public.municipality_events
for update
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
)
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists municipality_events_delete_editor on public.municipality_events;
create policy municipality_events_delete_editor
on public.municipality_events
for delete
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_delete_tenant_communications(tenant_key)
);

commit;

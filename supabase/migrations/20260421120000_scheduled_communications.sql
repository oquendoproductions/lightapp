alter table public.municipality_alerts
  drop constraint if exists municipality_alerts_status_check;

alter table public.municipality_alerts
  add constraint municipality_alerts_status_check
  check (status in ('draft', 'scheduled', 'published', 'archived'));

alter table public.municipality_events
  drop constraint if exists municipality_events_status_check;

alter table public.municipality_events
  add constraint municipality_events_status_check
  check (status in ('draft', 'scheduled', 'published', 'archived'));

drop policy if exists municipality_alerts_select_scoped on public.municipality_alerts;
create policy municipality_alerts_select_scoped
on public.municipality_alerts
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
  and (
    status = 'published'
    or (
      status = 'scheduled'
      and published_at is not null
      and published_at <= now()
    )
    or public.can_manage_tenant_communications(tenant_key)
  )
);

drop policy if exists municipality_events_select_scoped on public.municipality_events;
create policy municipality_events_select_scoped
on public.municipality_events
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
  and (
    status = 'published'
    or (
      status = 'scheduled'
      and published_at is not null
      and published_at <= now()
    )
    or public.can_manage_tenant_communications(tenant_key)
  )
);

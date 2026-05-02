create extension if not exists pg_cron with schema extensions;

create or replace function public.promote_due_scheduled_communications()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_count integer := 0;
  event_count integer := 0;
begin
  update public.municipality_alerts
  set
    status = 'published',
    updated_at = now()
  where status = 'scheduled'
    and published_at is not null
    and published_at <= now();

  get diagnostics alert_count = row_count;

  update public.municipality_events
  set
    status = 'published',
    updated_at = now()
  where status = 'scheduled'
    and published_at is not null
    and published_at <= now();

  get diagnostics event_count = row_count;

  return jsonb_build_object(
    'alerts_published', alert_count,
    'events_published', event_count
  );
end;
$$;

grant execute on function public.promote_due_scheduled_communications() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'municipality_alerts'
  ) then
    alter publication supabase_realtime add table public.municipality_alerts;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'municipality_events'
  ) then
    alter publication supabase_realtime add table public.municipality_events;
  end if;
end
$$;

drop policy if exists municipality_alerts_select_scoped on public.municipality_alerts;
create policy municipality_alerts_select_scoped
on public.municipality_alerts
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
  and (
    status = 'published'
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
    or public.can_manage_tenant_communications(tenant_key)
  )
);

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'cityreport-promote-scheduled-communications'
  ) then
    perform cron.schedule(
      'cityreport-promote-scheduled-communications',
      '* * * * *',
      'select public.promote_due_scheduled_communications();'
    );
  end if;
end
$$;

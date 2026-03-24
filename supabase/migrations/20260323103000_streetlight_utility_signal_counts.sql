begin;

create or replace function public.streetlight_utility_signal_counts()
returns table (
  incident_id text,
  reported_count integer,
  latest_reported_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    urs.incident_id,
    count(*)::integer as reported_count,
    max(coalesce(urs.updated_at, urs.reported_at)) as latest_reported_at
  from public.utility_report_status urs
  where urs.tenant_key = public.request_tenant_key()
  group by urs.incident_id;
$$;

revoke all on function public.streetlight_utility_signal_counts() from public;
grant execute on function public.streetlight_utility_signal_counts() to anon, authenticated;

commit;

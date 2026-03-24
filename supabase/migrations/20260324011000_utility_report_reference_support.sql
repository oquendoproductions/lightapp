begin;

alter table public.utility_report_status
  add column if not exists report_reference text;

drop function if exists public.streetlight_utility_signal_counts();

create function public.streetlight_utility_signal_counts()
returns table (
  incident_id text,
  reported_count integer,
  reference_count integer,
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
    count(*) filter (
      where nullif(btrim(coalesce(urs.report_reference, '')), '') is not null
    )::integer as reference_count,
    max(coalesce(urs.updated_at, urs.reported_at)) as latest_reported_at
  from public.utility_report_status urs
  where urs.tenant_key = public.request_tenant_key()
  group by urs.incident_id;
$$;

revoke all on function public.streetlight_utility_signal_counts() from public;
grant execute on function public.streetlight_utility_signal_counts() to anon, authenticated;

commit;

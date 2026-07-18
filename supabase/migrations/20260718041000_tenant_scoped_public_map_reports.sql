create or replace function public.public_map_reports(p_tenant_key text)
returns table (
  id text,
  created_at timestamptz,
  lat double precision,
  lng double precision,
  report_type text,
  report_quality text,
  note text,
  light_id text,
  report_number text,
  report_domain text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id::text,
    r.created_at::timestamptz,
    r.lat::double precision,
    r.lng::double precision,
    r.report_type::text,
    r.report_quality::text,
    r.note::text,
    r.light_id::text,
    r.report_number::text,
    r.report_domain::text
  from public.reports r
  where lower(btrim(r.tenant_key::text)) = lower(btrim(coalesce(p_tenant_key, '')))
  order by r.created_at desc, r.id desc;
$$;

revoke all on function public.public_map_reports(text) from public;
grant execute on function public.public_map_reports(text) to anon, authenticated;

comment on function public.public_map_reports(text) is
  'Returns public-safe map report fields for exactly one tenant.';

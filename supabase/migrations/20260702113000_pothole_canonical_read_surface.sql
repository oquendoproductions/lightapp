begin;

create or replace function public.canonical_legacy_pothole_incident_id(p_pothole_id text)
returns text
language sql
immutable
as $$
  select case
    when nullif(btrim(coalesce(p_pothole_id, '')), '') is null then ''
    else 'pothole:' || btrim(p_pothole_id)
  end;
$$;

create or replace view public.canonical_report_rows_v1 as
with generic_reports as (
  select
    ('reports:' || r.id::text) as canonical_report_key,
    'reports'::text as source_table,
    r.id::text as source_row_id,
    r.tenant_key,
    r.created_at,
    r.lat,
    r.lng,
    coalesce(nullif(btrim(r.report_type), ''), 'Report') as report_type,
    coalesce(nullif(lower(btrim(r.report_quality)), ''), 'bad') as report_quality,
    r.note,
    btrim(coalesce(r.light_id, '')) as light_id,
    nullif(lower(btrim(coalesce(r.report_domain, ''))), '') as report_domain,
    r.report_number,
    r.reporter_user_id,
    r.reporter_name,
    r.reporter_phone,
    r.reporter_email,
    null::text as legacy_pothole_id,
    btrim(coalesce(r.light_id, '')) as canonical_incident_id
  from public.reports r
  where btrim(coalesce(r.light_id, '')) <> ''
),
legacy_pothole_reports as (
  select
    ('pothole_reports:' || p.id::text) as canonical_report_key,
    'pothole_reports'::text as source_table,
    p.id::text as source_row_id,
    p.tenant_key,
    p.created_at,
    coalesce(p.lat, ph.lat) as lat,
    coalesce(p.lng, ph.lng) as lng,
    'Pothole'::text as report_type,
    'bad'::text as report_quality,
    p.note,
    public.canonical_legacy_pothole_incident_id(p.pothole_id::text) as light_id,
    'potholes'::text as report_domain,
    p.report_number,
    p.reporter_user_id,
    p.reporter_name,
    p.reporter_phone,
    p.reporter_email,
    p.pothole_id::text as legacy_pothole_id,
    public.canonical_legacy_pothole_incident_id(p.pothole_id::text) as canonical_incident_id
  from public.pothole_reports p
  left join public.potholes ph
    on ph.id = p.pothole_id
   and ph.tenant_key = p.tenant_key
)
select *
from generic_reports
union all
select *
from legacy_pothole_reports;

comment on function public.canonical_legacy_pothole_incident_id(text) is
  'Builds the canonical shared incident id for legacy pothole rows. This is phase-one read-surface plumbing only.';

comment on view public.canonical_report_rows_v1 is
  'Unified read surface for generic reports plus legacy pothole reports. Safe to adopt in new builds before legacy pothole writes are mirrored into reports.';

grant select on public.canonical_report_rows_v1 to anon, authenticated;

commit;

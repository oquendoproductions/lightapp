begin;

create table if not exists public.incident_location_cache (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade default public.request_tenant_key(),
  domain text not null,
  incident_id text not null,
  lat double precision,
  lng double precision,
  location_label text,
  nearest_address text,
  nearest_cross_street text,
  nearest_intersection text,
  nearest_landmark text,
  geo_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_key, domain, incident_id)
);

create index if not exists incident_location_cache_updated_idx
  on public.incident_location_cache (tenant_key, updated_at desc);

create index if not exists incident_location_cache_geo_updated_idx
  on public.incident_location_cache (tenant_key, geo_updated_at desc);

create or replace function public.set_incident_location_cache_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_incident_location_cache_updated_at on public.incident_location_cache;
create trigger trg_incident_location_cache_updated_at
before update on public.incident_location_cache
for each row
execute function public.set_incident_location_cache_updated_at();

alter table public.incident_location_cache enable row level security;

grant select on public.incident_location_cache to anon, authenticated;

drop policy if exists incident_location_cache_select_scoped on public.incident_location_cache;
create policy incident_location_cache_select_scoped
on public.incident_location_cache
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
);

with source_rows as (
  select distinct on (
    lower(trim(coalesce(r.tenant_key, ''))),
    lower(trim(coalesce(r.report_domain, ''))),
    trim(coalesce(r.light_id, ''))
  )
    lower(trim(coalesce(r.tenant_key, ''))) as tenant_key,
    lower(trim(coalesce(r.report_domain, ''))) as domain,
    trim(coalesce(r.light_id, '')) as incident_id,
    r.lat,
    r.lng,
    nullif(trim(substring(r.note from 'Location:\s*([^|]+)')), '') as location_label,
    nullif(trim(substring(r.note from 'Address:\s*([^|]+)')), '') as nearest_address,
    nullif(trim(substring(r.note from 'Cross Street:\s*([^|]+)')), '') as nearest_cross_street,
    nullif(trim(substring(r.note from 'Intersection:\s*([^|]+)')), '') as nearest_intersection,
    nullif(trim(substring(r.note from 'Landmark:\s*([^|]+)')), '') as nearest_landmark,
    r.created_at as geo_updated_at
  from public.reports r
  where
    coalesce(trim(r.tenant_key), '') <> ''
    and coalesce(trim(r.light_id), '') <> ''
    and lower(trim(coalesce(r.report_domain, ''))) not in ('', 'streetlights', 'potholes', 'water_drain_issues', 'water_main')
  order by
    lower(trim(coalesce(r.tenant_key, ''))),
    lower(trim(coalesce(r.report_domain, ''))),
    trim(coalesce(r.light_id, '')),
    r.created_at desc
)
insert into public.incident_location_cache (
  tenant_key,
  domain,
  incident_id,
  lat,
  lng,
  location_label,
  nearest_address,
  nearest_cross_street,
  nearest_intersection,
  nearest_landmark,
  geo_updated_at
)
select
  sr.tenant_key,
  sr.domain,
  sr.incident_id,
  sr.lat,
  sr.lng,
  coalesce(sr.location_label, sr.nearest_address),
  coalesce(sr.nearest_address, sr.location_label),
  sr.nearest_cross_street,
  sr.nearest_intersection,
  sr.nearest_landmark,
  sr.geo_updated_at
from source_rows sr
where
  sr.tenant_key <> ''
  and sr.domain <> ''
  and sr.incident_id <> ''
  and (
    sr.location_label is not null
    or sr.nearest_address is not null
    or sr.nearest_cross_street is not null
    or sr.nearest_intersection is not null
    or sr.nearest_landmark is not null
  )
on conflict (tenant_key, domain, incident_id) do update
set
  lat = coalesce(excluded.lat, public.incident_location_cache.lat),
  lng = coalesce(excluded.lng, public.incident_location_cache.lng),
  location_label = coalesce(excluded.location_label, public.incident_location_cache.location_label),
  nearest_address = coalesce(excluded.nearest_address, public.incident_location_cache.nearest_address),
  nearest_cross_street = coalesce(excluded.nearest_cross_street, public.incident_location_cache.nearest_cross_street),
  nearest_intersection = coalesce(excluded.nearest_intersection, public.incident_location_cache.nearest_intersection),
  nearest_landmark = coalesce(excluded.nearest_landmark, public.incident_location_cache.nearest_landmark),
  geo_updated_at = coalesce(excluded.geo_updated_at, public.incident_location_cache.geo_updated_at),
  updated_at = now();

commit;

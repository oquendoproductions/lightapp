-- Week 4: Persist geocoded location details directly on domain ID rows
-- No separate geo cache table.

begin;

alter table if exists public.potholes
  add column if not exists nearest_address text,
  add column if not exists nearest_cross_street text,
  add column if not exists nearest_landmark text,
  add column if not exists geo_updated_at timestamptz;

alter table if exists public.official_lights
  add column if not exists nearest_address text,
  add column if not exists nearest_cross_street text,
  add column if not exists nearest_landmark text,
  add column if not exists geo_updated_at timestamptz;

alter table if exists public.incident_state_current
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists nearest_address text,
  add column if not exists nearest_cross_street text,
  add column if not exists nearest_landmark text,
  add column if not exists geo_updated_at timestamptz;

-- Backfill nearest_address from existing pothole label if available.
update public.potholes
set nearest_address = location_label
where coalesce(trim(nearest_address), '') = ''
  and coalesce(trim(location_label), '') <> '';

commit;

-- Week 4.5 hardening: canonical water/drain incident cache table
-- Keeps water/drain geo fields out of derived lifecycle snapshot tables.

create table if not exists public.water_drain_incidents (
  incident_id text primary key,
  issue_type text not null default 'storm_drain_clog'
    check (issue_type in ('sewer_backup', 'storm_drain_clog')),
  lat double precision,
  lng double precision,
  nearest_address text,
  nearest_cross_street text,
  nearest_landmark text,
  geo_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists water_drain_incidents_geo_updated_idx
  on public.water_drain_incidents (geo_updated_at desc);

create index if not exists water_drain_incidents_updated_idx
  on public.water_drain_incidents (updated_at desc);

create or replace function public.set_water_drain_incidents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_water_drain_incidents_updated_at on public.water_drain_incidents;
create trigger trg_water_drain_incidents_updated_at
before update on public.water_drain_incidents
for each row
execute function public.set_water_drain_incidents_updated_at();

alter table public.water_drain_incidents enable row level security;

drop policy if exists water_drain_incidents_select_public on public.water_drain_incidents;
create policy water_drain_incidents_select_public
on public.water_drain_incidents
for select
to public
using (true);

drop policy if exists water_drain_incidents_insert_admin on public.water_drain_incidents;
create policy water_drain_incidents_insert_admin
on public.water_drain_incidents
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists water_drain_incidents_update_admin on public.water_drain_incidents;
create policy water_drain_incidents_update_admin
on public.water_drain_incidents
for update
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists water_drain_incidents_delete_admin on public.water_drain_incidents;
create policy water_drain_incidents_delete_admin
on public.water_drain_incidents
for delete
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

-- Backfill from existing water/drain reports.
with water_rows as (
  select distinct on (r.light_id)
    r.light_id as incident_id,
    case
      when r.note ilike '%Water issue: Sewer Backup%' then 'sewer_backup'
      when r.note ilike '%Water issue: Storm Drain Blocked / Flooding%' then 'storm_drain_clog'
      else 'storm_drain_clog'
    end as issue_type,
    r.lat,
    r.lng,
    nullif(trim(substring(r.note from 'Location:\s*([^|]+)')), '') as nearest_address,
    r.created_at as geo_updated_at
  from public.reports r
  where
    coalesce(r.light_id, '') like 'water_drain_issues:%'
    or coalesce(r.light_id, '') like 'water_main:%'
    or coalesce(r.note, '') ilike '%Water issue:%'
  order by r.light_id, r.created_at desc
)
insert into public.water_drain_incidents (
  incident_id,
  issue_type,
  lat,
  lng,
  nearest_address,
  geo_updated_at
)
select
  wr.incident_id,
  wr.issue_type,
  wr.lat,
  wr.lng,
  wr.nearest_address,
  wr.geo_updated_at
from water_rows wr
where coalesce(wr.incident_id, '') <> ''
on conflict (incident_id) do update
set
  issue_type = excluded.issue_type,
  lat = excluded.lat,
  lng = excluded.lng,
  nearest_address = coalesce(excluded.nearest_address, public.water_drain_incidents.nearest_address),
  geo_updated_at = coalesce(excluded.geo_updated_at, public.water_drain_incidents.geo_updated_at),
  updated_at = now();

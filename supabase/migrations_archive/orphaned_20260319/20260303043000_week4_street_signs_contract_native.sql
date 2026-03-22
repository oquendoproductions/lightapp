-- Week 4 pilot domain expansion (contract-native):
-- - Add street_signs domain
-- - Add official_signs asset table
-- - Keep lifecycle/event/export/metrics contract unchanged

begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'incident_domain'
      and e.enumlabel = 'street_signs'
  ) then
    alter type public.incident_domain add value 'street_signs';
  end if;
end
$$;

commit;

begin;

create table if not exists public.official_signs (
  id uuid primary key default gen_random_uuid(),
  sign_type text not null default 'other',
  lat double precision not null,
  lng double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index if not exists official_signs_active_idx
  on public.official_signs (active, created_at desc);

create index if not exists official_signs_lat_lng_idx
  on public.official_signs (lat, lng);

alter table public.official_signs enable row level security;
alter table public.official_signs force row level security;

revoke all on public.official_signs from public;

drop policy if exists official_signs_select_public on public.official_signs;
create policy official_signs_select_public
on public.official_signs
for select
to public
using (active = true);

drop policy if exists official_signs_insert_admin on public.official_signs;
create policy official_signs_insert_admin
on public.official_signs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists official_signs_update_admin on public.official_signs;
create policy official_signs_update_admin
on public.official_signs
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

drop policy if exists official_signs_delete_admin on public.official_signs;
create policy official_signs_delete_admin
on public.official_signs
for delete
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

create or replace function public.map_incident_domain_from_light_id(p_light_id text)
returns public.incident_domain
language plpgsql
stable
as $$
declare
  v text := lower(trim(coalesce(p_light_id, '')));
begin
  if v like 'potholes:%' or v like 'pothole:%' then
    return 'potholes'::public.incident_domain;
  elsif v like 'street_signs:%' or v like 'street_sign:%' then
    return 'street_signs'::public.incident_domain;
  elsif v like 'power_outage:%' then
    return 'power_outage'::public.incident_domain;
  elsif v like 'water_main:%' then
    return 'water_main'::public.incident_domain;
  end if;

  if exists (select 1 from public.official_signs s where s.id::text = v) then
    return 'street_signs'::public.incident_domain;
  end if;

  return 'streetlights'::public.incident_domain;
end;
$$;

create or replace function public.map_incident_domain_from_report(
  p_light_id text,
  p_report_domain text,
  p_report_type text
)
returns public.incident_domain
language plpgsql
stable
as $$
declare
  lid text := lower(trim(coalesce(p_light_id, '')));
  d text := lower(trim(coalesce(p_report_domain, '')));
  t text := lower(trim(coalesce(p_report_type, '')));
begin
  if lid like 'potholes:%' then return 'potholes'::public.incident_domain; end if;
  if lid like 'street_signs:%' then return 'street_signs'::public.incident_domain; end if;
  if lid like 'power_outage:%' then return 'power_outage'::public.incident_domain; end if;
  if lid like 'water_main:%' then return 'water_main'::public.incident_domain; end if;
  if exists (select 1 from public.official_signs s where s.id::text = lid) then return 'street_signs'::public.incident_domain; end if;

  if d in ('streetlights','streetlight') then return 'streetlights'::public.incident_domain; end if;
  if d in ('street_signs','street signs','street_sign','street sign','signs','street sign issue') then return 'street_signs'::public.incident_domain; end if;
  if d in ('potholes','pothole') then return 'potholes'::public.incident_domain; end if;
  if d in ('power_outage','power outage','power','outage') then return 'power_outage'::public.incident_domain; end if;
  if d in ('water_main','water main','water main break','water_main_break') then return 'water_main'::public.incident_domain; end if;

  if t like '%sign%' then return 'street_signs'::public.incident_domain; end if;
  if t like '%pothole%' then return 'potholes'::public.incident_domain; end if;
  if t like '%water%' then return 'water_main'::public.incident_domain; end if;
  if t like '%power%' then return 'power_outage'::public.incident_domain; end if;

  return 'streetlights'::public.incident_domain;
end;
$$;

insert into public.tenant_visibility_config (tenant_key, domain, visibility)
values
  ('default', 'streetlights'::public.incident_domain, 'internal_only'),
  ('default', 'potholes'::public.incident_domain, 'public'),
  ('default', 'street_signs'::public.incident_domain, 'public'),
  ('default', 'power_outage'::public.incident_domain, 'internal_only'),
  ('default', 'water_main'::public.incident_domain, 'internal_only')
on conflict (tenant_key, domain)
do update set
  visibility = excluded.visibility,
  updated_at = now();

create or replace view public.export_incident_detail_v1 as
with metrics as (
  select * from public.incident_timeline_metrics_v1
),
general_reports as (
  select
    r.id as report_id,
    r.report_number,
    public.map_incident_domain_from_report(
      r.light_id,
      null::text,
      coalesce(r.report_type, '')
    ) as domain,
    r.light_id as incident_id,
    r.created_at as submitted_at,
    r.note as notes,
    r.reporter_name,
    r.reporter_email,
    r.reporter_phone,
    r.reporter_user_id
  from public.reports r
  where coalesce(lower(r.report_quality), 'bad') = 'bad'
),
potholes as (
  select
    p.id as report_id,
    p.report_number,
    'potholes'::public.incident_domain as domain,
    ('pothole:' || p.pothole_id)::text as incident_id,
    p.created_at as submitted_at,
    p.note as notes,
    p.reporter_name,
    p.reporter_email,
    p.reporter_phone,
    p.reporter_user_id
  from public.pothole_reports p
),
all_rows as (
  select *
  from general_reports
  where domain in ('streetlights'::public.incident_domain, 'street_signs'::public.incident_domain, 'power_outage'::public.incident_domain, 'water_main'::public.incident_domain)
  union all
  select * from potholes
)
select
  a.report_id as source_report_id,
  a.report_number,
  a.domain,
  a.incident_id,
  a.submitted_at as submission_timestamp,
  m.first_fixed_at as fix_timestamp,
  m.time_to_fix_seconds as time_to_close_seconds,
  m.current_state,
  a.reporter_name,
  a.reporter_email,
  a.reporter_phone,
  a.notes as note,
  'user'::text as source,
  a.report_id,
  a.submitted_at,
  m.first_reported_at,
  m.first_confirmed_at,
  m.first_fixed_at as fixed_at,
  m.last_state_change_at,
  m.time_to_confirm_seconds,
  m.time_to_fix_seconds,
  m.reopen_count,
  m.is_chronic,
  a.reporter_user_id,
  a.notes,
  a.incident_id as aggregation_id
from all_rows a
left join metrics m
  on m.domain = a.domain
 and m.incident_id = a.incident_id;

commit;

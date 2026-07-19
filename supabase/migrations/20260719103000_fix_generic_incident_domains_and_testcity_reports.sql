begin;

create or replace function public.map_incident_domain_from_light_id(p_light_id text)
returns public.incident_domain
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_light_id, '')));
begin
  if v like 'potholes:%' or v like 'pothole:%' then return 'potholes'::public.incident_domain; end if;
  if v like 'water_drain_issues:%' or v like 'water_drain:%' then return 'water_drain_issues'::public.incident_domain; end if;
  if v like 'street_signs:%' or v like 'street_sign:%' then return 'street_signs'::public.incident_domain; end if;
  if v like 'power_outage:%' then return 'power_outage'::public.incident_domain; end if;
  if v like 'water_main:%' then return 'water_main'::public.incident_domain; end if;
  if v like 'park_equipment:%' then return 'park_equipment'::public.incident_domain; end if;
  if v like 'downed_tree:%' then return 'downed_tree'::public.incident_domain; end if;
  if v like 'encampment:%' then return 'encampment'::public.incident_domain; end if;
  if v like 'illegal_dumping:%' then return 'illegal_dumping'::public.incident_domain; end if;
  if v like 'graffiti:%' then return 'graffiti'::public.incident_domain; end if;
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
immutable
as $$
declare
  mapped_from_id public.incident_domain := public.map_incident_domain_from_light_id(p_light_id);
  lid text := lower(trim(coalesce(p_light_id, '')));
  d text := lower(trim(coalesce(p_report_domain, '')));
  t text := lower(trim(coalesce(p_report_type, '')));
begin
  if lid like '%:%' then return mapped_from_id; end if;

  if d in ('streetlights', 'streetlight') then return 'streetlights'::public.incident_domain; end if;
  if d in ('potholes', 'pothole') then return 'potholes'::public.incident_domain; end if;
  if d in ('street_signs', 'street signs', 'street_sign', 'street sign') then return 'street_signs'::public.incident_domain; end if;
  if d in ('water_drain_issues', 'water drain issues', 'water / drain issues', 'water_drain', 'water drain', 'drain issues', 'drain_issues', 'sewer', 'storm_drain', 'storm drain') then return 'water_drain_issues'::public.incident_domain; end if;
  if d in ('power_outage', 'power outage', 'power', 'outage') then return 'power_outage'::public.incident_domain; end if;
  if d in ('water_main', 'water main', 'water main break', 'water_main_break') then return 'water_main'::public.incident_domain; end if;
  if d in ('park_equipment', 'park equipment') then return 'park_equipment'::public.incident_domain; end if;
  if d in ('downed_tree', 'downed tree') then return 'downed_tree'::public.incident_domain; end if;
  if d in ('encampment', 'encampments') then return 'encampment'::public.incident_domain; end if;
  if d in ('illegal_dumping', 'illegal dumping') then return 'illegal_dumping'::public.incident_domain; end if;
  if d = 'graffiti' then return 'graffiti'::public.incident_domain; end if;

  if t like '%pothole%' then return 'potholes'::public.incident_domain; end if;
  if t like '%sewer%' or t like '%drain%' or t like '%storm%' then return 'water_drain_issues'::public.incident_domain; end if;
  if t like '%water_main%' or t like '%main break%' then return 'water_main'::public.incident_domain; end if;
  if t like '%power%' then return 'power_outage'::public.incident_domain; end if;
  if t like '%downed tree%' or t like '%tree down%' then return 'downed_tree'::public.incident_domain; end if;
  if t like '%encampment%' then return 'encampment'::public.incident_domain; end if;
  if t like '%illegal dumping%' then return 'illegal_dumping'::public.incident_domain; end if;
  if t like '%graffiti%' then return 'graffiti'::public.incident_domain; end if;
  if t like '%park equipment%' then return 'park_equipment'::public.incident_domain; end if;

  return mapped_from_id;
end;
$$;

update public.reports
set tenant_key = 'testcity1'
where report_number in ('DT-R00000940', 'WD-R00000787')
  and tenant_key = 'ashtabulacity';

update public.incident_events
set
  tenant_key = 'testcity1',
  domain = case
    when incident_id = 'downed_tree:41.61225:-80.82014' then 'downed_tree'::public.incident_domain
    else 'water_drain_issues'::public.incident_domain
  end
where incident_id in (
  'downed_tree:41.61225:-80.82014',
  'water_drain_issues:41.61250:-80.82027'
);

update public.incident_events
set domain = public.map_incident_domain_from_light_id(incident_id)
where domain is distinct from public.map_incident_domain_from_light_id(incident_id);

do $$
begin
  perform set_config('cityreport.incident_snapshot_apply', 'on', true);

  truncate table public.incident_state_current;

  insert into public.incident_state_current (
    tenant_key,
    domain,
    incident_id,
    state,
    last_changed_at,
    reopen_count
  )
  select
    latest.tenant_key,
    latest.domain,
    latest.incident_id,
    latest.new_state,
    latest.changed_at,
    latest.reopen_count
  from (
    select
      coalesce(nullif(lower(trim(e.tenant_key)), ''), 'ashtabulacity') as tenant_key,
      e.domain,
      e.incident_id,
      e.new_state,
      e.changed_at,
      count(*) filter (
        where coalesce(e.previous_state, 'reported'::public.incident_state) in ('fixed'::public.incident_state, 'archived'::public.incident_state)
          and e.new_state = 'reported'::public.incident_state
      ) over (partition by coalesce(nullif(lower(trim(e.tenant_key)), ''), 'ashtabulacity'), e.domain, e.incident_id) as reopen_count,
      row_number() over (
        partition by coalesce(nullif(lower(trim(e.tenant_key)), ''), 'ashtabulacity'), e.domain, e.incident_id
        order by e.changed_at desc, e.id desc
      ) as row_rank
    from public.incident_events e
  ) latest
  where latest.row_rank = 1;

  perform set_config('cityreport.incident_snapshot_apply', 'off', true);
exception when others then
  perform set_config('cityreport.incident_snapshot_apply', 'off', true);
  raise;
end
$$;

commit;

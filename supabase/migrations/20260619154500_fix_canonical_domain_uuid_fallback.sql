begin;

create or replace function public.resolve_canonical_incident_domain_key(
  p_lifecycle_domain text default null,
  p_incident_id text default null,
  p_report_domain text default null,
  p_report_type text default null
)
returns text
language plpgsql
stable
set search_path = public
as $function$
declare
  lifecycle_key text := public.normalize_incident_domain_key(p_lifecycle_domain);
  incident_id_text text := lower(trim(coalesce(p_incident_id, '')));
  incident_has_domain_prefix boolean := position(':' in incident_id_text) > 0;
  incident_prefix text := case
    when incident_has_domain_prefix
      then public.normalize_incident_domain_key(split_part(incident_id_text, ':', 1))
    else null
  end;
  report_key text := public.normalize_incident_domain_key(p_report_domain);
  type_key text := public.normalize_incident_domain_key(p_report_type);
begin
  if report_key is not null and exists (
    select 1
    from public.domain_definitions dd
    where dd.key = report_key
  ) then
    return report_key;
  end if;

  if incident_prefix is not null and exists (
    select 1
    from public.domain_definitions dd
    where dd.key = incident_prefix
  ) then
    return incident_prefix;
  end if;

  if lifecycle_key is not null and lifecycle_key <> 'streetlights' then
    return lifecycle_key;
  end if;

  if report_key is not null then
    return report_key;
  end if;

  if incident_has_domain_prefix and incident_prefix is not null then
    return incident_prefix;
  end if;

  if lifecycle_key is not null then
    return lifecycle_key;
  end if;

  if type_key = 'potholes' then return 'potholes'; end if;
  if type_key = 'street_signs' then return 'street_signs'; end if;
  if type_key = 'water_drain_issues' then return 'water_drain_issues'; end if;
  if type_key = 'power_outage' then return 'power_outage'; end if;
  if type_key = 'water_main' then return 'water_main'; end if;

  return 'streetlights';
end;
$function$;

commit;

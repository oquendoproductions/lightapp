begin;

create or replace function public.resolve_domain_report_prefix(
  p_domain_key text,
  p_current_report_number text default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  normalized_key text := nullif(
    regexp_replace(lower(trim(coalesce(p_domain_key, ''))), '[^a-z0-9]+', '_', 'g'),
    ''
  );
  explicit_prefix text;
  fallback_prefix text;
begin
  if normalized_key is not null then
    select nullif(upper(btrim(dd.report_prefix)), '')
      into explicit_prefix
    from public.domain_definitions dd
    where dd.key = normalized_key
    limit 1;
  end if;

  if explicit_prefix is not null then
    return explicit_prefix;
  end if;

  fallback_prefix := case normalized_key
    when 'streetlights' then 'SLR'
    when 'street_signs' then 'SSR'
    when 'potholes' then 'PHR'
    when 'water_drain_issues' then 'WDR'
    when 'power_outage' then 'POR'
    when 'water_main' then 'WMR'
    else null
  end;

  if fallback_prefix is not null then
    return fallback_prefix;
  end if;

  explicit_prefix := substring(upper(trim(coalesce(p_current_report_number, ''))) from '^R-([A-Z0-9]+)[0-9]+$');
  if explicit_prefix is null then
    explicit_prefix := substring(upper(trim(coalesce(p_current_report_number, ''))) from '^([A-Z0-9]+)[0-9]+$');
  end if;
  if explicit_prefix is not null and explicit_prefix <> '' then
    return explicit_prefix;
  end if;

  raise exception 'Missing report_prefix for domain definition %', coalesce(normalized_key, '(unknown)');
end;
$function$;

commit;

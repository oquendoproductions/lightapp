begin;

create or replace function public.derive_domain_report_prefix(p_domain_key text)
returns text
language plpgsql
immutable
as $function$
declare
  normalized text := nullif(
    regexp_replace(lower(trim(coalesce(p_domain_key, ''))), '[^a-z0-9]+', '_', 'g'),
    ''
  );
  parts text[];
  prefix text := '';
  part text;
  i integer;
  fill_char text;
begin
  if normalized is null then
    return null;
  end if;

  parts := array_remove(regexp_split_to_array(normalized, '_+'), '');
  if array_length(parts, 1) is null then
    return upper(substr(normalized, 1, 3));
  end if;

  if array_length(parts, 1) = 1 then
    return upper(substr(parts[1], 1, 3));
  end if;

  foreach part in array parts loop
    if coalesce(part, '') = '' then
      continue;
    end if;
    prefix := prefix || upper(substr(part, 1, 1));
    exit when char_length(prefix) >= 3;
  end loop;

  if char_length(prefix) < 3 then
    foreach part in array parts loop
      if coalesce(part, '') = '' then
        continue;
      end if;
      i := 2;
      while i <= char_length(part) and char_length(prefix) < 3 loop
        prefix := prefix || upper(substr(part, i, 1));
        i := i + 1;
      end loop;
      exit when char_length(prefix) >= 3;
    end loop;
  end if;

  if char_length(prefix) = 0 then
    prefix := upper(substr(normalized, 1, 3));
  end if;

  fill_char := substr(prefix || 'XXX', 1, 1);
  return rpad(substr(prefix, 1, 3), 3, fill_char);
end;
$function$;

update public.domain_definitions
set report_prefix = case
  when key = 'streetlights' then 'SLR'
  when key = 'street_signs' then 'SSR'
  when key = 'potholes' then 'PHR'
  when key = 'water_drain_issues' then 'WDR'
  when key = 'power_outage' then 'POR'
  when key = 'water_main' then 'WMR'
  else public.derive_domain_report_prefix(key)
end
where coalesce(btrim(report_prefix), '') = '';

create or replace function public.set_reports_report_number()
returns trigger
language plpgsql
as $function$
declare
  pfx text;
  n bigint;
  lid text := lower(trim(coalesce(new.light_id, '')));
  normalized_report_domain text := nullif(
    regexp_replace(lower(trim(coalesce(new.report_domain, ''))), '[^a-z0-9]+', '_', 'g'),
    ''
  );
  derived_domain_key text := coalesce(
    normalized_report_domain,
    nullif(split_part(lid, ':', 1), '')
  );
begin
  if new.report_number is not null and btrim(new.report_number) <> '' then
    return new;
  end if;

  if lid like 'power_outage:%' or derived_domain_key = 'power_outage' then
    pfx := 'POR';
    n := nextval('public.report_num_por_seq');
  elsif lid like 'water_main:%' or derived_domain_key = 'water_main' then
    pfx := 'WMR';
    n := nextval('public.report_num_wmr_seq');
  elsif lid like 'water_drain_issues:%'
     or lid like 'water_drain:%'
     or lid like 'storm_drain:%'
     or lid like 'sewer_backup:%'
     or derived_domain_key in ('water_drain_issues', 'water_drain', 'storm_drain', 'sewer_backup') then
    pfx := 'WDR';
    n := nextval('public.report_num_wdr_seq');
  elsif lid like 'street_signs:%'
     or derived_domain_key = 'street_signs'
     or exists (
       select 1
       from public.official_signs s
       where s.id::text = lid
     ) then
    pfx := 'SSR';
    n := nextval('public.report_num_ssr_seq');
  else
    select coalesce(
        nullif(upper(btrim(dd.report_prefix)), ''),
        public.derive_domain_report_prefix(dd.key)
      )
      into pfx
    from public.domain_definitions dd
    where dd.key = derived_domain_key
    limit 1;

    if coalesce(btrim(pfx), '') = '' and derived_domain_key is not null then
      pfx := public.derive_domain_report_prefix(derived_domain_key);
    end if;

    if pfx is not null and pfx <> '' then
      n := nextval('public.report_num_custom_domain_seq');
    else
      pfx := 'SLR';
      n := nextval('public.report_num_slr_seq');
    end if;
  end if;

  new.report_number := pfx || lpad(n::text, 7, '0');
  return new;
end;
$function$;

update public.reports r
set report_domain = split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1)
where coalesce(btrim(r.report_domain), '') = ''
  and exists (
    select 1
    from public.domain_definitions dd
    where dd.key = split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1)
  );

update public.reports r
set report_number = coalesce(nullif(upper(btrim(dd.report_prefix)), ''), public.derive_domain_report_prefix(dd.key)) || substring(r.report_number from 4)
from public.domain_definitions dd
where dd.key = coalesce(
    nullif(regexp_replace(lower(trim(coalesce(r.report_domain, ''))), '[^a-z0-9]+', '_', 'g'), ''),
    nullif(split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1), '')
  )
  and r.report_number ~* '^slr[0-9]+$'
  and coalesce(
    nullif(regexp_replace(lower(trim(coalesce(r.report_domain, ''))), '[^a-z0-9]+', '_', 'g'), ''),
    nullif(split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1), '')
  ) not in (
    'streetlights',
    'street_signs',
    'potholes',
    'water_drain_issues',
    'power_outage',
    'water_main'
  );

commit;

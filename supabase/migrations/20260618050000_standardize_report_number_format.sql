begin;

create sequence if not exists public.report_num_phr_seq;

grant select, usage on sequence public.report_num_phr_seq to anon, authenticated, service_role;
grant select, usage on sequence public.report_num_phr_seq to codex_worker;

create or replace function public.resolve_domain_report_prefix(
  p_domain_key text,
  p_current_report_number text default null
)
returns text
language plpgsql
stable
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

  pfx := public.resolve_domain_report_prefix(derived_domain_key, null);

  if lid like 'power_outage:%' or derived_domain_key = 'power_outage' then
    n := nextval('public.report_num_por_seq');
  elsif lid like 'water_main:%' or derived_domain_key = 'water_main' then
    n := nextval('public.report_num_wmr_seq');
  elsif lid like 'water_drain_issues:%'
     or lid like 'water_drain:%'
     or lid like 'storm_drain:%'
     or lid like 'sewer_backup:%'
     or derived_domain_key in ('water_drain_issues', 'water_drain', 'storm_drain', 'sewer_backup') then
    n := nextval('public.report_num_wdr_seq');
  elsif lid like 'street_signs:%'
     or derived_domain_key = 'street_signs'
     or exists (
       select 1
       from public.official_signs s
       where s.id::text = lid
     ) then
    n := nextval('public.report_num_ssr_seq');
  elsif derived_domain_key = 'streetlights' or derived_domain_key is null then
    n := nextval('public.report_num_slr_seq');
  else
    n := nextval('public.report_num_custom_domain_seq');
  end if;

  new.report_number := 'R-' || pfx || lpad(n::text, 7, '0');
  return new;
end;
$function$;

create or replace function public.set_pothole_reports_report_number()
returns trigger
language plpgsql
as $function$
declare
  n bigint;
begin
  if new.report_number is not null and btrim(new.report_number) <> '' then
    return new;
  end if;

  n := nextval('public.report_num_phr_seq');
  new.report_number := 'R-PHR' || lpad(n::text, 7, '0');
  return new;
end;
$function$;

drop trigger if exists trg_set_pothole_reports_report_number on public.pothole_reports;
create trigger trg_set_pothole_reports_report_number
before insert on public.pothole_reports
for each row execute function public.set_pothole_reports_report_number();

update public.reports r
set report_domain = split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1)
where coalesce(btrim(r.report_domain), '') = ''
  and exists (
    select 1
    from public.domain_definitions dd
    where dd.key = split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1)
  );

update public.reports r
set report_number = 'R-' || public.resolve_domain_report_prefix(
    coalesce(
      nullif(regexp_replace(lower(trim(coalesce(r.report_domain, ''))), '[^a-z0-9]+', '_', 'g'), ''),
      nullif(split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1), '')
    ),
    r.report_number
  ) || lpad(substring(upper(trim(r.report_number)) from '([0-9]+)$'), 7, '0')
where substring(upper(trim(r.report_number)) from '([0-9]+)$') is not null
  and trim(coalesce(r.report_number, '')) <> '';

update public.pothole_reports p
set report_number = 'R-PHR' || lpad(substring(upper(trim(p.report_number)) from '([0-9]+)$'), 7, '0')
where substring(upper(trim(p.report_number)) from '([0-9]+)$') is not null
  and trim(coalesce(p.report_number, '')) <> '';

drop function if exists public.derive_domain_report_prefix(text);

commit;

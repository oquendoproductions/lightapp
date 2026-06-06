begin;

create sequence if not exists public.report_num_custom_domain_seq;

grant select, usage on sequence public.report_num_custom_domain_seq to anon, authenticated, service_role;
grant select, usage on sequence public.report_num_custom_domain_seq to codex_worker;

create or replace function public.set_reports_report_number()
returns trigger
language plpgsql
as $function$
declare
  pfx text;
  n bigint;
  lid text := lower(trim(coalesce(new.light_id, '')));
  derived_domain_key text := nullif(split_part(lower(trim(coalesce(new.light_id, ''))), ':', 1), '');
begin
  if new.report_number is not null and btrim(new.report_number) <> '' then
    return new;
  end if;

  if lid like 'power_outage:%' then
    pfx := 'POR';
    n := nextval('public.report_num_por_seq');
  elsif lid like 'water_main:%' then
    pfx := 'WMR';
    n := nextval('public.report_num_wmr_seq');
  elsif lid like 'water_drain_issues:%'
     or lid like 'water_drain:%'
     or lid like 'storm_drain:%'
     or lid like 'sewer_backup:%' then
    pfx := 'WDR';
    n := nextval('public.report_num_wdr_seq');
  elsif lid like 'street_signs:%'
     or exists (
       select 1
       from public.official_signs s
       where s.id::text = lid
     ) then
    pfx := 'SSR';
    n := nextval('public.report_num_ssr_seq');
  else
    select upper(btrim(dd.report_prefix))
      into pfx
    from public.domain_definitions dd
    where dd.key = derived_domain_key
      and dd.report_prefix is not null
      and btrim(dd.report_prefix) <> ''
    limit 1;

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
set report_number = upper(btrim(dd.report_prefix)) || substring(r.report_number from 4)
from public.domain_definitions dd
where dd.key = split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1)
  and dd.report_prefix is not null
  and btrim(dd.report_prefix) <> ''
  and r.report_number ~* '^slr[0-9]+$'
  and split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1) not in (
    'streetlights',
    'street_signs',
    'potholes',
    'water_drain_issues',
    'power_outage',
    'water_main'
  );

commit;

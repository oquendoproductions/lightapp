begin;

create sequence if not exists public.report_num_ssr_seq;

grant select, usage on sequence public.report_num_ssr_seq to anon, authenticated, service_role;
grant select, usage on sequence public.report_num_ssr_seq to codex_worker;

create or replace function public.set_reports_report_number()
returns trigger
language plpgsql
as $function$
declare
  pfx text;
  n bigint;
  lid text := lower(trim(coalesce(new.light_id, '')));
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
  elsif lid like 'street_signs:%'
     or exists (
       select 1
       from public.official_signs s
       where s.id::text = lid
     ) then
    pfx := 'SSR';
    n := nextval('public.report_num_ssr_seq');
  else
    pfx := 'SLR';
    n := nextval('public.report_num_slr_seq');
  end if;

  new.report_number := pfx || lpad(n::text, 7, '0');
  return new;
end;
$function$;

commit;

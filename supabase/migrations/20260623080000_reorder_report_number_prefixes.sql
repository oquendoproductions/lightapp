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
  normalized_report_number text := upper(trim(coalesce(p_current_report_number, '')));
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
    when 'streetlights' then 'SL'
    when 'street_signs' then 'SS'
    when 'potholes' then 'PH'
    when 'water_drain_issues' then 'WD'
    when 'power_outage' then 'PO'
    when 'water_main' then 'WM'
    else null
  end;

  if fallback_prefix is not null then
    return fallback_prefix;
  end if;

  explicit_prefix := case
    when normalized_report_number ~ '^(R-)?SLR[0-9]+$' or normalized_report_number ~ '^SL-R[0-9]+$' then 'SL'
    when normalized_report_number ~ '^(R-)?SSR[0-9]+$' or normalized_report_number ~ '^SS-R[0-9]+$' then 'SS'
    when normalized_report_number ~ '^(R-)?PHR[0-9]+$' or normalized_report_number ~ '^PH-R[0-9]+$' then 'PH'
    when normalized_report_number ~ '^(R-)?WDR[0-9]+$' or normalized_report_number ~ '^WD-R[0-9]+$' then 'WD'
    when normalized_report_number ~ '^(R-)?POR[0-9]+$' or normalized_report_number ~ '^PO-R[0-9]+$' then 'PO'
    when normalized_report_number ~ '^(R-)?WMR[0-9]+$' or normalized_report_number ~ '^WM-R[0-9]+$' then 'WM'
    else null
  end;

  if explicit_prefix is not null and explicit_prefix <> '' then
    return explicit_prefix;
  end if;

  if normalized_report_number <> '' then
    select upper(btrim(dd.report_prefix))
      into explicit_prefix
    from public.domain_definitions dd
    where nullif(upper(btrim(dd.report_prefix)), '') is not null
      and (
        normalized_report_number like upper(btrim(dd.report_prefix)) || '-R%'
        or normalized_report_number like 'R-' || upper(btrim(dd.report_prefix)) || '%'
        or normalized_report_number like upper(btrim(dd.report_prefix)) || '%'
      )
    order by char_length(upper(btrim(dd.report_prefix))) desc, upper(btrim(dd.report_prefix)) desc
    limit 1;
  end if;

  if explicit_prefix is not null and explicit_prefix <> '' then
    return explicit_prefix;
  end if;

  explicit_prefix := substring(normalized_report_number from '^([A-Z0-9]+)-R[0-9]+$');
  if explicit_prefix is null then
    explicit_prefix := substring(normalized_report_number from '^R-([A-Z0-9]+)[0-9]+$');
  end if;
  if explicit_prefix is null then
    explicit_prefix := substring(normalized_report_number from '^([A-Z0-9]+)[0-9]+$');
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

  new.report_number := pfx || '-R' || lpad(n::text, 8, '0');
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
  new.report_number := 'PH-R' || lpad(n::text, 8, '0');
  return new;
end;
$function$;

with normalized as (
  select
    r.id,
    public.resolve_domain_report_prefix(
      coalesce(
        nullif(regexp_replace(lower(trim(coalesce(r.report_domain, ''))), '[^a-z0-9]+', '_', 'g'), ''),
        nullif(split_part(lower(trim(coalesce(r.light_id, ''))), ':', 1), '')
      ),
      r.report_number
    ) as pfx,
    lpad(substring(upper(trim(r.report_number)) from '([0-9]+)$'), 8, '0') as digits_text,
    coalesce(r.created_at, now()) as created_at
  from public.reports r
  where substring(upper(trim(r.report_number)) from '([0-9]+)$') is not null
    and trim(coalesce(r.report_number, '')) <> ''
),
ranked as (
  select
    n.id,
    n.pfx,
    n.digits_text,
    n.created_at,
    (n.pfx || '-R' || n.digits_text) as target_report_number,
    (n.digits_text)::bigint as digits_value,
    row_number() over (
      partition by (n.pfx || '-R' || n.digits_text)
      order by n.created_at asc, n.id asc
    ) as target_rank
  from normalized n
),
max_by_prefix as (
  select
    pfx,
    max(digits_value) as max_digits_value
  from ranked
  group by pfx
),
extras as (
  select
    r.id,
    r.pfx,
    row_number() over (
      partition by r.pfx
      order by r.target_report_number asc, r.created_at asc, r.id asc
    ) as extra_rank
  from ranked r
  where r.target_rank > 1
),
finalized as (
  select
    r.id,
    case
      when r.target_rank = 1 then r.target_report_number
      else r.pfx || '-R' || lpad((m.max_digits_value + e.extra_rank)::text, 8, '0')
    end as final_report_number
  from ranked r
  left join max_by_prefix m
    on m.pfx = r.pfx
  left join extras e
    on e.id = r.id
)
update public.reports dst
set report_number = f.final_report_number
from finalized f
where dst.id = f.id
  and dst.report_number is distinct from f.final_report_number;

with normalized as (
  select
    p.id,
    'PH' as pfx,
    lpad(substring(upper(trim(p.report_number)) from '([0-9]+)$'), 8, '0') as digits_text,
    coalesce(p.created_at, now()) as created_at
  from public.pothole_reports p
  where substring(upper(trim(p.report_number)) from '([0-9]+)$') is not null
    and trim(coalesce(p.report_number, '')) <> ''
),
ranked as (
  select
    n.id,
    n.pfx,
    n.digits_text,
    n.created_at,
    (n.pfx || '-R' || n.digits_text) as target_report_number,
    (n.digits_text)::bigint as digits_value,
    row_number() over (
      partition by (n.pfx || '-R' || n.digits_text)
      order by n.created_at asc, n.id asc
    ) as target_rank
  from normalized n
),
max_by_prefix as (
  select
    pfx,
    max(digits_value) as max_digits_value
  from ranked
  group by pfx
),
extras as (
  select
    r.id,
    row_number() over (
      partition by r.pfx
      order by r.target_report_number asc, r.created_at asc, r.id asc
    ) as extra_rank
  from ranked r
  where r.target_rank > 1
),
finalized as (
  select
    r.id,
    case
      when r.target_rank = 1 then r.target_report_number
      else r.pfx || '-R' || lpad((m.max_digits_value + e.extra_rank)::text, 8, '0')
    end as final_report_number
  from ranked r
  left join max_by_prefix m
    on m.pfx = r.pfx
  left join extras e
    on e.id = r.id
)
update public.pothole_reports dst
set report_number = f.final_report_number
from finalized f
where dst.id = f.id
  and dst.report_number is distinct from f.final_report_number;

select setval(
  'public.report_num_slr_seq',
  greatest(
    coalesce((
      select max(substring(report_number from '([0-9]+)$')::bigint)
      from public.reports
      where upper(trim(coalesce(report_number, ''))) like 'SL-R%'
    ), 0),
    1
  ),
  true
);

select setval(
  'public.report_num_ssr_seq',
  greatest(
    coalesce((
      select max(substring(report_number from '([0-9]+)$')::bigint)
      from public.reports
      where upper(trim(coalesce(report_number, ''))) like 'SS-R%'
    ), 0),
    1
  ),
  true
);

select setval(
  'public.report_num_wdr_seq',
  greatest(
    coalesce((
      select max(substring(report_number from '([0-9]+)$')::bigint)
      from public.reports
      where upper(trim(coalesce(report_number, ''))) like 'WD-R%'
    ), 0),
    1
  ),
  true
);

select setval(
  'public.report_num_por_seq',
  greatest(
    coalesce((
      select max(substring(report_number from '([0-9]+)$')::bigint)
      from public.reports
      where upper(trim(coalesce(report_number, ''))) like 'PO-R%'
    ), 0),
    1
  ),
  true
);

select setval(
  'public.report_num_wmr_seq',
  greatest(
    coalesce((
      select max(substring(report_number from '([0-9]+)$')::bigint)
      from public.reports
      where upper(trim(coalesce(report_number, ''))) like 'WM-R%'
    ), 0),
    1
  ),
  true
);

select setval(
  'public.report_num_phr_seq',
  greatest(
    coalesce((
      select max(substring(report_number from '([0-9]+)$')::bigint)
      from public.pothole_reports
      where upper(trim(coalesce(report_number, ''))) like 'PH-R%'
    ), 0),
    1
  ),
  true
);

select setval(
  'public.report_num_custom_domain_seq',
  greatest(
    coalesce((
      select max(substring(report_number from '([0-9]+)$')::bigint)
      from public.reports
      where upper(trim(coalesce(report_number, ''))) ~ '^[A-Z0-9]+-R[0-9]+$'
        and split_part(upper(trim(report_number)), '-R', 1) not in ('SL', 'SS', 'PH', 'WD', 'PO', 'WM')
    ), 0),
    1
  ),
  true
);

commit;

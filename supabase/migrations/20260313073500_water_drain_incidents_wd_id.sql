-- Add persistent public-readable WD ID to water/drain cache rows.

create or replace function public.make_water_drain_id_from_incident(_incident_id text)
returns text
language plpgsql
immutable
as $$
declare
  s text := coalesce(trim(_incident_id), '');
  m text[];
  lat5 text;
  lng5 text;
  h bigint := 2166136261;
  i int;
  c int;
begin
  if s = '' then
    return 'WD0000000000';
  end if;

  -- Preferred path: deterministic coordinate-based ID (same style as PH IDs).
  m := regexp_match(s, '^[^:]+:([-]?[0-9]+(?:\.[0-9]+)?):([-]?[0-9]+(?:\.[0-9]+)?)$');
  if m is not null then
    lat5 := right(rpad(split_part(replace(m[1], '-', ''), '.', 2), 5, '0'), 5);
    lng5 := right(rpad(split_part(replace(m[2], '-', ''), '.', 2), 5, '0'), 5);

    if lat5 ~ '^[0-9]{5}$' and lng5 ~ '^[0-9]{5}$' then
      return 'WD' || lng5 || lat5;
    end if;
  end if;

  -- Fallback for legacy/non-coordinate keys.
  for i in 1..char_length(s) loop
    c := ascii(substr(s, i, 1));
    h := (h # c);
    h := mod(h * 16777619, 4294967296);
  end loop;

  return 'WD' || lpad(h::text, 10, '0');
end;
$$;

alter table public.water_drain_incidents
  add column if not exists wd_id text;

update public.water_drain_incidents
set wd_id = public.make_water_drain_id_from_incident(incident_id)
where coalesce(nullif(trim(wd_id), ''), '') = '';

create index if not exists water_drain_incidents_wd_id_idx
  on public.water_drain_incidents (wd_id);

create or replace function public.set_water_drain_incidents_wd_id()
returns trigger
language plpgsql
as $$
begin
  new.wd_id := public.make_water_drain_id_from_incident(new.incident_id);
  return new;
end;
$$;

drop trigger if exists trg_water_drain_incidents_wd_id on public.water_drain_incidents;
create trigger trg_water_drain_incidents_wd_id
before insert or update of incident_id
on public.water_drain_incidents
for each row
execute function public.set_water_drain_incidents_wd_id();

-- Ensure no nulls survive after trigger/backfill.
update public.water_drain_incidents
set wd_id = public.make_water_drain_id_from_incident(incident_id)
where wd_id is null;

alter table public.water_drain_incidents
  alter column wd_id set not null;

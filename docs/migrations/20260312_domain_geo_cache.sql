-- Domain geo cache for address enrichment across all domains
-- Stores rounded-coordinate keyed location data to reduce repeat Google lookups.

create table if not exists public.domain_geo_cache (
  id bigserial primary key,
  lat double precision not null,
  lng double precision not null,
  lat_rounded numeric(9,5) not null,
  lng_rounded numeric(9,5) not null,
  nearest_address text,
  nearest_cross_street text,
  nearest_landmark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domain_geo_cache_lat_lng_rounded_unique unique (lat_rounded, lng_rounded)
);

create index if not exists domain_geo_cache_updated_at_idx
  on public.domain_geo_cache (updated_at desc);

create or replace function public.tg_domain_geo_cache_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_domain_geo_cache_set_updated_at on public.domain_geo_cache;
create trigger trg_domain_geo_cache_set_updated_at
before update on public.domain_geo_cache
for each row
execute function public.tg_domain_geo_cache_set_updated_at();

alter table public.domain_geo_cache enable row level security;

grant select, insert, update on public.domain_geo_cache to anon, authenticated;
grant usage, select on sequence public.domain_geo_cache_id_seq to anon, authenticated;

drop policy if exists domain_geo_cache_select on public.domain_geo_cache;
create policy domain_geo_cache_select
on public.domain_geo_cache
for select
to anon, authenticated
using (true);

drop policy if exists domain_geo_cache_insert on public.domain_geo_cache;
create policy domain_geo_cache_insert
on public.domain_geo_cache
for insert
to anon, authenticated
with check (true);

drop policy if exists domain_geo_cache_update on public.domain_geo_cache;
create policy domain_geo_cache_update
on public.domain_geo_cache
for update
to anon, authenticated
using (true)
with check (true);

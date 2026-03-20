begin;

create table if not exists public.streetlight_location_cache (
  light_id text primary key,
  lat double precision,
  lng double precision,
  nearest_address text not null default '',
  nearest_street text not null default '',
  nearest_cross_street text not null default '',
  nearest_intersection text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists streetlight_location_cache_updated_idx
  on public.streetlight_location_cache (updated_at desc);

alter table public.streetlight_location_cache enable row level security;
alter table public.streetlight_location_cache force row level security;

revoke all on public.streetlight_location_cache from public;
grant select on public.streetlight_location_cache to anon, authenticated;
grant insert, update on public.streetlight_location_cache to authenticated;

drop policy if exists streetlight_location_cache_read on public.streetlight_location_cache;
create policy streetlight_location_cache_read
on public.streetlight_location_cache
for select
to anon, authenticated
using (true);

drop policy if exists streetlight_location_cache_write on public.streetlight_location_cache;
create policy streetlight_location_cache_write
on public.streetlight_location_cache
for insert
to authenticated
with check (true);

drop policy if exists streetlight_location_cache_update on public.streetlight_location_cache;
create policy streetlight_location_cache_update
on public.streetlight_location_cache
for update
to authenticated
using (true)
with check (true);

create or replace function public.touch_streetlight_location_cache_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_streetlight_location_cache_updated_at on public.streetlight_location_cache;
create trigger trg_touch_streetlight_location_cache_updated_at
before update on public.streetlight_location_cache
for each row
execute function public.touch_streetlight_location_cache_updated_at();

commit;

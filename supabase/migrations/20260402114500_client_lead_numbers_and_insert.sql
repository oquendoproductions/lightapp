begin;

create sequence if not exists public.client_leads_lead_number_seq;

alter table public.client_leads
  add column if not exists lead_number bigint;

alter sequence public.client_leads_lead_number_seq
  owned by public.client_leads.lead_number;

alter table public.client_leads
  alter column lead_number set default nextval('public.client_leads_lead_number_seq');

with ordered as (
  select
    id,
    row_number() over (order by created_at asc, id asc) as next_lead_number
  from public.client_leads
  where lead_number is null
)
update public.client_leads leads
set lead_number = ordered.next_lead_number
from ordered
where leads.id = ordered.id;

do $$
declare
  next_value bigint;
begin
  select coalesce(max(lead_number), 0) + 1 into next_value from public.client_leads;
  execute format('alter sequence public.client_leads_lead_number_seq restart with %s', greatest(next_value, 1));
end $$;

create unique index if not exists idx_client_leads_lead_number
  on public.client_leads (lead_number);

alter table public.client_leads
  drop constraint if exists client_leads_source_check;

alter table public.client_leads
  add constraint client_leads_source_check
  check (source in ('homepage', 'pcp'));

grant insert on table public.client_leads to authenticated;
grant usage, select on sequence public.client_leads_lead_number_seq to authenticated;

drop policy if exists client_leads_platform_insert on public.client_leads;
create policy client_leads_platform_insert
  on public.client_leads
  for insert
  to authenticated
  with check (
    public.is_platform_admin(auth.uid())
    or public.has_platform_permission(auth.uid(), 'leads.edit')
  );

commit;

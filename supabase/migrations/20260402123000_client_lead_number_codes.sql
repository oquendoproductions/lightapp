begin;

drop index if exists idx_client_leads_lead_number;

alter table public.client_leads
  alter column lead_number drop default;

alter table public.client_leads
  alter column lead_number type text
  using (
    case
      when lead_number is null then null
      else 'LD' || lpad(lead_number::text, 4, '0')
    end
  );

alter sequence public.client_leads_lead_number_seq
  owned by public.client_leads.lead_number;

alter table public.client_leads
  alter column lead_number set default ('LD' || lpad(nextval('public.client_leads_lead_number_seq')::text, 4, '0'));

do $$
declare
  next_value bigint;
begin
  select coalesce(
    max(nullif(regexp_replace(coalesce(lead_number, ''), '\D', '', 'g'), '')::bigint),
    0
  ) + 1
  into next_value
  from public.client_leads;

  execute format(
    'alter sequence public.client_leads_lead_number_seq restart with %s',
    greatest(next_value, 1)
  );
end $$;

create unique index if not exists idx_client_leads_lead_number
  on public.client_leads (lead_number);

commit;

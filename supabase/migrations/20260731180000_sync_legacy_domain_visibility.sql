begin;

-- Tenant-domain assignments are the control-plane source of truth.  The
-- legacy visibility table still drives the public map for the original enum
-- domains, so keep it in lockstep whenever an assignment is changed.
create or replace function public.sync_legacy_domain_visibility_from_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.domain_key in (
    'streetlights',
    'street_signs',
    'potholes',
    'water_drain_issues',
    'power_outage',
    'water_main'
  ) then
    insert into public.tenant_visibility_config (tenant_key, domain, visibility)
    values (
      new.tenant_key,
      new.domain_key::public.incident_domain,
      case
        when new.active = true and new.visibility = 'enabled' then 'public'
        else 'internal_only'
      end
    )
    on conflict (tenant_key, domain) do update
      set visibility = excluded.visibility;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_legacy_domain_visibility_from_assignment
  on public.tenant_domain_assignments;

create trigger trg_sync_legacy_domain_visibility_from_assignment
after insert or update of tenant_key, domain_key, active, visibility
on public.tenant_domain_assignments
for each row
execute function public.sync_legacy_domain_visibility_from_assignment();

-- Repair existing rows that were saved through the assignment editor before
-- the two visibility stores were synchronized.
insert into public.tenant_visibility_config (tenant_key, domain, visibility)
select
  tda.tenant_key,
  tda.domain_key::public.incident_domain,
  case
    when tda.active = true and tda.visibility = 'enabled' then 'public'
    else 'internal_only'
  end
from public.tenant_domain_assignments tda
where tda.domain_key in (
  'streetlights',
  'street_signs',
  'potholes',
  'water_drain_issues',
  'power_outage',
  'water_main'
)
on conflict (tenant_key, domain) do update
  set visibility = excluded.visibility;

commit;

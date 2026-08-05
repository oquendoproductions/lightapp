begin;

-- tenant_domain_assignments is the current authority for tenant domain
-- behavior.  The original incident-domain config table is retained for
-- legacy readers, so keep its management flag synchronized for the enum
-- domains it can represent.  Without this, editing an assignment can leave
-- Potholes (and the other legacy domains) with two contradictory settings.
update public.tenant_domain_configs as legacy
set organization_monitored_repairs = assignment.organization_monitored_repairs
from public.tenant_domain_assignments as assignment
where assignment.tenant_key = legacy.tenant_key
  and assignment.domain_key = legacy.domain::text
  and assignment.domain_key in (
    'streetlights',
    'street_signs',
    'potholes',
    'water_drain_issues',
    'power_outage',
    'water_main'
  )
  and legacy.organization_monitored_repairs is distinct from assignment.organization_monitored_repairs;

create or replace function public.sync_legacy_tenant_domain_management()
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
    insert into public.tenant_domain_configs (
      tenant_key,
      domain,
      domain_type,
      organization_monitored_repairs,
      updated_by
    )
    values (
      new.tenant_key,
      new.domain_key::public.incident_domain,
      coalesce(
        (
          select case
            when dd.domain_class = 'asset_backed' then 'asset_backed'
            else 'incident_driven'
          end
          from public.domain_definitions as dd
          where dd.key = new.domain_key
          limit 1
        ),
        'incident_driven'
      ),
      coalesce(new.organization_monitored_repairs, false),
      new.updated_by
    )
    on conflict (tenant_key, domain) do update
    set organization_monitored_repairs = excluded.organization_monitored_repairs,
        updated_by = excluded.updated_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_legacy_tenant_domain_management on public.tenant_domain_assignments;
create trigger trg_sync_legacy_tenant_domain_management
after insert or update of organization_monitored_repairs on public.tenant_domain_assignments
for each row
execute function public.sync_legacy_tenant_domain_management();

commit;

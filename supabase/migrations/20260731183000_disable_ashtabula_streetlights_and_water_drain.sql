begin;

-- Reconcile Ashtabula's saved PCP intent.  These domains were marked disabled
-- in the control plane but their active assignment records still exposed them
-- to the public map.
insert into public.tenant_domain_assignments (tenant_key, domain_key, active, visibility)
values
  ('ashtabulacity', 'streetlights', false, 'disabled'),
  ('ashtabulacity', 'water_drain_issues', false, 'disabled')
on conflict (tenant_key, domain_key) do update
  set active = false,
      visibility = 'disabled';

commit;

-- Street signs are incident-driven. An older tenant-domain seed marked them
-- asset-backed, which conflicts with the registry/domain catalog model.
update public.tenant_domain_configs
set domain_type = 'incident_driven'
where domain = 'street_signs'::public.incident_domain
  and coalesce(domain_type, '') <> 'incident_driven';

-- A field worker may determine that a reported incident cannot be verified.
-- Keep that outcome distinct from a newly reported or confirmed incident.
alter type public.incident_state add value if not exists 'unconfirmed' after 'confirmed';

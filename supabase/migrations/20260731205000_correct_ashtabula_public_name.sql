-- The original seed label was a product placeholder. The native location
-- switcher and map header read tenants.name when no public profile label is set.
update public.tenants
set name = 'Ashtabula City (Unofficial)'
where tenant_key = 'ashtabulacity'
  and name = 'CityReport Public Tool';

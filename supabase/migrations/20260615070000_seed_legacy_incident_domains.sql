begin;

insert into public.domain_definitions (
  key,
  label,
  description,
  domain_class,
  status,
  icon_key,
  icon_src,
  ownership_model,
  report_prefix,
  default_visibility,
  default_notification_email,
  default_organization_monitored_repairs,
  allow_report_images,
  sort_order,
  created_by,
  updated_by
)
values
  (
    'downed_tree',
    'Downed Tree',
    'Incident-driven reporting for downed trees, fallen limbs, and tree debris blocking public areas or creating safety hazards.',
    'incident_driven',
    'active',
    null,
    '/icon-concepts-v4/domain/downed_tree_domain_icon_v4.svg',
    'org_managed',
    'DT',
    'enabled',
    null,
    true,
    true,
    70,
    null,
    null
  ),
  (
    'encampment',
    'Encampment',
    'Incident-driven reporting for encampments, associated debris, and public-space safety or sanitation concerns.',
    'incident_driven',
    'active',
    null,
    '/icon-concepts-v4/domain/encampment_domain_icon_v4.svg',
    'org_managed',
    'EC',
    'enabled',
    null,
    true,
    true,
    80,
    null,
    null
  ),
  (
    'illegal_dumping',
    'Illegal Dumping',
    'Incident-driven reporting for illegal dumping, debris piles, and unauthorized waste disposal that require investigation and cleanup.',
    'incident_driven',
    'active',
    null,
    '/icon-concepts-v4/domain/dumping_domain_icon_v4.svg',
    'org_managed',
    'ID',
    'enabled',
    null,
    true,
    true,
    90,
    null,
    null
  ),
  (
    'graffiti',
    'Graffiti',
    'Incident-driven reporting for graffiti, tagging, and surface vandalism on public infrastructure or public-facing property.',
    'incident_driven',
    'active',
    null,
    '/icon-concepts-v4/domain/graffiti_domain_icon_v4.svg',
    'org_managed',
    'GR',
    'enabled',
    null,
    true,
    true,
    100,
    null,
    null
  )
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  domain_class = excluded.domain_class,
  status = excluded.status,
  icon_key = excluded.icon_key,
  icon_src = excluded.icon_src,
  ownership_model = excluded.ownership_model,
  report_prefix = excluded.report_prefix,
  default_visibility = excluded.default_visibility,
  default_notification_email = excluded.default_notification_email,
  default_organization_monitored_repairs = excluded.default_organization_monitored_repairs,
  allow_report_images = excluded.allow_report_images,
  sort_order = excluded.sort_order,
  updated_at = now(),
  updated_by = excluded.updated_by;

insert into public.domain_issue_types (domain_key, issue_key, issue_label, sort_order)
values
  ('downed_tree', 'full_tree_down', 'Full Tree Down', 10),
  ('downed_tree', 'large_limb', 'Large Limb / Branch Down', 20),
  ('downed_tree', 'roadway_blocked', 'Roadway Blocked', 30),
  ('downed_tree', 'sidewalk_blocked', 'Sidewalk / Path Blocked', 40),
  ('encampment', 'new_encampment', 'New Encampment', 10),
  ('encampment', 'debris_sanitation', 'Debris / Sanitation Concern', 20),
  ('encampment', 'obstruction', 'Obstruction / Access Issue', 30),
  ('encampment', 'safety_concern', 'Safety Concern', 40),
  ('illegal_dumping', 'household_trash', 'Household Trash', 10),
  ('illegal_dumping', 'furniture', 'Furniture', 20),
  ('illegal_dumping', 'tires', 'Tires', 30),
  ('illegal_dumping', 'construction_debris', 'Construction Debris', 40),
  ('illegal_dumping', 'appliances', 'Appliances / Electronics', 50),
  ('graffiti', 'graffiti_tagging', 'Graffiti / Tagging', 10),
  ('graffiti', 'vandalized_sign', 'Vandalized Sign', 20),
  ('graffiti', 'public_building', 'Public Building / Structure', 30),
  ('graffiti', 'offensive_content', 'Offensive Content', 40),
  ('graffiti', 'repeat_location', 'Repeat Location', 50)
on conflict (domain_key, issue_key) do update
set
  issue_label = excluded.issue_label,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

commit;

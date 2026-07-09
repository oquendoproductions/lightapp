begin;

alter type public.incident_domain add value if not exists 'street_signs';
alter type public.incident_domain add value if not exists 'water_drain_issues';
alter type public.incident_domain add value if not exists 'park_equipment';
alter type public.incident_domain add value if not exists 'downed_tree';
alter type public.incident_domain add value if not exists 'encampment';
alter type public.incident_domain add value if not exists 'illegal_dumping';
alter type public.incident_domain add value if not exists 'graffiti';

commit;

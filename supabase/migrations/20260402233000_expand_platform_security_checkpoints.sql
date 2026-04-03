begin;

alter table public.platform_security_settings
  add column if not exists require_pin_for_organization_info_changes boolean not null default false,
  add column if not exists require_pin_for_contact_changes boolean not null default false,
  add column if not exists require_pin_for_organization_user_changes boolean not null default false,
  add column if not exists require_pin_for_organization_role_changes boolean not null default false,
  add column if not exists require_pin_for_domain_settings_changes boolean not null default false;

commit;

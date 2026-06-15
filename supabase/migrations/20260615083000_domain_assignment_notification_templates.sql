begin;

alter table public.tenant_domain_assignments
  add column if not exists notification_template_key text not null default 'standard_ops',
  add column if not exists notification_subject_template text,
  add column if not exists notification_body_template text;

update public.tenant_domain_assignments
set notification_template_key = coalesce(nullif(trim(notification_template_key), ''), 'standard_ops')
where coalesce(nullif(trim(notification_template_key), ''), '') = '';

commit;

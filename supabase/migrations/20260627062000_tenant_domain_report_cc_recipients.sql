begin;

alter table public.tenant_domain_assignments
  add column if not exists notification_cc_emails text;

commit;

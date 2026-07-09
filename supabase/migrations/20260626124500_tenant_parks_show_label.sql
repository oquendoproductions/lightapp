begin;

alter table public.tenant_parks
  add column if not exists show_label boolean not null default true;

commit;

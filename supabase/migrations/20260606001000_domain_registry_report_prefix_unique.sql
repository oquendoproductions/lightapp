begin;

create unique index if not exists domain_definitions_report_prefix_unique_idx
on public.domain_definitions ((upper(btrim(report_prefix))))
where report_prefix is not null and btrim(report_prefix) <> '';

commit;

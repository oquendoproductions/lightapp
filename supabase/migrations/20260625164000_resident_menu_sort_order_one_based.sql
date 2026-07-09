begin;

alter table public.organization_menu_links
  alter column sort_order set default 1;

alter table public.organization_menu_sections
  alter column sort_order set default 1;

with ranked_sections as (
  select
    id,
    row_number() over (
      partition by tenant_key
      order by coalesce(sort_order, 0), created_at, id
    ) as next_sort_order
  from public.organization_menu_sections
)
update public.organization_menu_sections oms
set sort_order = ranked_sections.next_sort_order
from ranked_sections
where oms.id = ranked_sections.id
  and oms.sort_order is distinct from ranked_sections.next_sort_order;

with ranked_links as (
  select
    id,
    row_number() over (
      partition by tenant_key, coalesce(nullif(btrim(section_label), ''), 'General')
      order by coalesce(sort_order, 0), created_at, id
    ) as next_sort_order
  from public.organization_menu_links
)
update public.organization_menu_links oml
set sort_order = ranked_links.next_sort_order
from ranked_links
where oml.id = ranked_links.id
  and oml.sort_order is distinct from ranked_links.next_sort_order;

commit;

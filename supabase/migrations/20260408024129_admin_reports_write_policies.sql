begin;

do $$
declare
  t text;
  lock_tables text[] := array[
    'light_actions',
    'official_lights',
    'official_signs',
    'fixed_lights'
  ];
  write_check text := '(' ||
    'public.is_platform_admin(auth.uid()) ' ||
    'or public.has_tenant_permission(auth.uid(), tenant_key, ''reports.edit'') ' ||
    'or public.has_tenant_permission(auth.uid(), tenant_key, ''admin_reports.access'')' ||
  ')';
begin
  foreach t in array lock_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check %s',
      t || '_rbac_write_insert',
      t,
      write_check
    );

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_update', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using %s with check %s',
      t || '_rbac_write_update',
      t,
      write_check,
      write_check
    );

    execute format('drop policy if exists %I on public.%I', t || '_rbac_write_delete', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using %s',
      t || '_rbac_write_delete',
      t,
      write_check
    );
  end loop;
end
$$;

commit;

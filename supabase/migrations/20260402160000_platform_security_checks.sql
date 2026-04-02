begin;

create table if not exists public.platform_user_security_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text,
  pin_enabled boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_security_settings (
  config_key text primary key,
  require_pin_for_role_changes boolean not null default false,
  require_pin_for_team_changes boolean not null default false,
  require_pin_for_account_changes boolean not null default false,
  require_pin_for_report_state_changes boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_security_settings_config_key_check
    check (config_key = 'default')
);

drop trigger if exists trg_platform_user_security_profiles_updated_at on public.platform_user_security_profiles;
create trigger trg_platform_user_security_profiles_updated_at
before update on public.platform_user_security_profiles
for each row
execute function public.touch_rbac_updated_at();

drop trigger if exists trg_platform_security_settings_updated_at on public.platform_security_settings;
create trigger trg_platform_security_settings_updated_at
before update on public.platform_security_settings
for each row
execute function public.touch_rbac_updated_at();

insert into public.platform_security_settings (config_key)
values ('default')
on conflict (config_key) do nothing;

grant select, insert, update on public.platform_user_security_profiles to authenticated;
grant select, insert, update on public.platform_security_settings to authenticated;

alter table public.platform_user_security_profiles enable row level security;
alter table public.platform_security_settings enable row level security;

drop policy if exists platform_user_security_profiles_select_self on public.platform_user_security_profiles;
create policy platform_user_security_profiles_select_self
on public.platform_user_security_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists platform_user_security_profiles_insert_self on public.platform_user_security_profiles;
create policy platform_user_security_profiles_insert_self
on public.platform_user_security_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists platform_user_security_profiles_update_self on public.platform_user_security_profiles;
create policy platform_user_security_profiles_update_self
on public.platform_user_security_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists platform_security_settings_select_scoped on public.platform_security_settings;
create policy platform_security_settings_select_scoped
on public.platform_security_settings
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'security.access')
  or public.has_platform_permission(auth.uid(), 'security.edit')
);

drop policy if exists platform_security_settings_insert_scoped on public.platform_security_settings;
create policy platform_security_settings_insert_scoped
on public.platform_security_settings
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'security.edit')
);

drop policy if exists platform_security_settings_update_scoped on public.platform_security_settings;
create policy platform_security_settings_update_scoped
on public.platform_security_settings
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'security.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'security.edit')
);

commit;

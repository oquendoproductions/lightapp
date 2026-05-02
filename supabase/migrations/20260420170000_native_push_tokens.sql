begin;

create table if not exists public.native_push_tokens (
  id bigint generated always as identity primary key,
  tenant_key text not null references public.tenants(tenant_key) on delete cascade default public.request_tenant_key(),
  user_id uuid not null,
  platform text not null check (platform in ('ios', 'android')),
  token text not null,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_key, user_id, platform, token)
);

create index if not exists native_push_tokens_user_idx
  on public.native_push_tokens (tenant_key, user_id, enabled, last_seen_at desc);

grant select, insert, update, delete on public.native_push_tokens to authenticated;

alter table public.native_push_tokens enable row level security;

drop policy if exists native_push_tokens_select_self on public.native_push_tokens;
create policy native_push_tokens_select_self
on public.native_push_tokens
for select
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

drop policy if exists native_push_tokens_insert_self on public.native_push_tokens;
create policy native_push_tokens_insert_self
on public.native_push_tokens
for insert
to authenticated
with check (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

drop policy if exists native_push_tokens_update_self on public.native_push_tokens;
create policy native_push_tokens_update_self
on public.native_push_tokens
for update
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
)
with check (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

drop policy if exists native_push_tokens_delete_self on public.native_push_tokens;
create policy native_push_tokens_delete_self
on public.native_push_tokens
for delete
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

commit;

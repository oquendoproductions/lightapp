create extension if not exists pgcrypto with schema extensions;

create table if not exists public.client_leads (
  id uuid primary key default extensions.gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  full_name text not null check (char_length(trim(full_name)) >= 2),
  work_email text not null check (position('@' in work_email) > 1),
  city_agency text not null check (char_length(trim(city_agency)) >= 2),
  role_title text not null check (char_length(trim(role_title)) >= 2),
  priority_domain text not null check (
    priority_domain in ('potholes', 'street_signs', 'water_drain_issues', 'streetlights', 'other')
  ),
  notes text,
  source text not null default 'homepage' check (source = 'homepage'),
  ip_hash text not null,
  email_hash text not null,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'contacted', 'closed'))
);

create index if not exists idx_client_leads_created_at
  on public.client_leads (created_at desc);

create index if not exists idx_client_leads_ip_hash_created_at
  on public.client_leads (ip_hash, created_at desc);

create index if not exists idx_client_leads_email_hash_created_at
  on public.client_leads (email_hash, created_at desc);

alter table public.client_leads enable row level security;

revoke all on table public.client_leads from anon;
revoke all on table public.client_leads from authenticated;

grant insert on table public.client_leads to service_role;

drop policy if exists "service role insert client leads" on public.client_leads;
create policy "service role insert client leads"
  on public.client_leads
  for insert
  to service_role
  with check (true);

-- Truqpedia Supabase schema
-- Execute this file in the Supabase SQL editor or with `supabase db push`.

create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_mode text not null default 'speed' check (default_mode in ('speed', 'deep')),
  web_search_enabled boolean not null default false,
  locale text not null default 'pt-BR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) <= 160),
  mode text not null default 'speed' check (mode in ('speed', 'deep')),
  pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  provider_id text check (provider_id in ('groq', 'openrouter', 'gemini', 'cohere', 'grok')),
  model text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  token_count integer check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_provider_settings (
  id text primary key check (id in ('groq', 'openrouter', 'gemini', 'cohere', 'grok')),
  display_name text not null,
  enabled boolean not null default true,
  priority integer not null check (priority > 0),
  speed_model text not null,
  deep_model text not null,
  base_url text,
  timeout_ms integer not null default 25000 check (timeout_ms between 5000 and 120000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_metrics (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null check (provider_id in ('groq', 'openrouter', 'gemini', 'cohere', 'grok')),
  model text not null,
  mode text not null check (mode in ('speed', 'deep')),
  success boolean not null,
  latency_ms integer not null default 0,
  error_message text,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.web_search_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  query text not null,
  provider text,
  result_count integer not null default 0,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'private' check (visibility in ('private', 'company', 'global')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  collection_id uuid references public.knowledge_collections(id) on delete set null,
  file_name text not null,
  mime_type text not null,
  storage_path text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  document_id uuid references public.document_assets(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'error')),
  encrypted_credentials jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_updated
  on public.conversations(user_id, updated_at desc)
  where archived_at is null;

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at asc);

create index if not exists idx_messages_user_created
  on public.messages(user_id, created_at desc);

create index if not exists idx_provider_metrics_provider_created
  on public.provider_metrics(provider_id, created_at desc);

create index if not exists idx_usage_logs_user_created
  on public.usage_logs(user_id, created_at desc);

create index if not exists idx_audit_logs_created
  on public.audit_logs(created_at desc);

create index if not exists idx_web_search_logs_user_created
  on public.web_search_logs(user_id, created_at desc);

create index if not exists idx_document_assets_owner
  on public.document_assets(owner_user_id, created_at desc);

create index if not exists idx_knowledge_chunks_collection
  on public.knowledge_chunks(collection_id);

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists trg_ai_provider_settings_updated_at on public.ai_provider_settings;
create trigger trg_ai_provider_settings_updated_at
before update on public.ai_provider_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_knowledge_collections_updated_at on public.knowledge_collections;
create trigger trg_knowledge_collections_updated_at
before update on public.knowledge_collections
for each row execute function public.set_updated_at();

drop trigger if exists trg_document_assets_updated_at on public.document_assets;
create trigger trg_document_assets_updated_at
before update on public.document_assets
for each row execute function public.set_updated_at();

drop trigger if exists trg_integration_connections_updated_at on public.integration_connections;
create trigger trg_integration_connections_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

insert into public.ai_provider_settings
  (id, display_name, enabled, priority, speed_model, deep_model, base_url, timeout_ms)
values
  ('groq', 'Groq', true, 10, 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'https://api.groq.com/openai/v1', 20000),
  ('openrouter', 'OpenRouter', true, 20, 'meta-llama/llama-3.1-8b-instruct:free', 'anthropic/claude-3.5-sonnet', 'https://openrouter.ai/api/v1', 25000),
  ('gemini', 'Gemini', true, 30, 'gemini-1.5-flash', 'gemini-1.5-pro', null, 25000),
  ('cohere', 'Cohere', true, 40, 'command-r7b-12-2024', 'command-r-plus', null, 25000),
  ('grok', 'Grok / xAI', true, 50, 'grok-3-mini', 'grok-3', 'https://api.x.ai/v1', 30000)
on conflict (id) do update set
  display_name = excluded.display_name,
  priority = excluded.priority,
  speed_model = excluded.speed_model,
  deep_model = excluded.deep_model,
  base_url = excluded.base_url,
  timeout_ms = excluded.timeout_ms;

alter table public.user_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.ai_provider_settings enable row level security;
alter table public.provider_metrics enable row level security;
alter table public.usage_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.web_search_logs enable row level security;
alter table public.knowledge_collections enable row level security;
alter table public.document_assets enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.integration_connections enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.user_profiles;
create policy "profiles_select_own_or_admin"
on public.user_profiles for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.user_profiles;
create policy "profiles_update_own_or_admin"
on public.user_profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "settings_own_all" on public.user_settings;
create policy "settings_own_all"
on public.user_settings for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "conversations_own_all" on public.conversations;
create policy "conversations_own_all"
on public.conversations for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "messages_own_all" on public.messages;
create policy "messages_own_all"
on public.messages for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "provider_settings_admin_select" on public.ai_provider_settings;
create policy "provider_settings_admin_select"
on public.ai_provider_settings for select
using (public.is_admin());

drop policy if exists "provider_settings_admin_write" on public.ai_provider_settings;
create policy "provider_settings_admin_write"
on public.ai_provider_settings for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "provider_metrics_admin_select" on public.provider_metrics;
create policy "provider_metrics_admin_select"
on public.provider_metrics for select
using (public.is_admin());

drop policy if exists "usage_logs_admin_select" on public.usage_logs;
create policy "usage_logs_admin_select"
on public.usage_logs for select
using (public.is_admin());

drop policy if exists "usage_logs_owner_select" on public.usage_logs;
create policy "usage_logs_owner_select"
on public.usage_logs for select
using (user_id = auth.uid());

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select"
on public.audit_logs for select
using (public.is_admin());

drop policy if exists "web_search_logs_owner_select" on public.web_search_logs;
create policy "web_search_logs_owner_select"
on public.web_search_logs for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "collections_owner_all" on public.knowledge_collections;
create policy "collections_owner_all"
on public.knowledge_collections for all
using (owner_user_id = auth.uid() or public.is_admin())
with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "documents_owner_all" on public.document_assets;
create policy "documents_owner_all"
on public.document_assets for all
using (owner_user_id = auth.uid() or public.is_admin())
with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "chunks_owner_all" on public.knowledge_chunks;
create policy "chunks_owner_all"
on public.knowledge_chunks for all
using (owner_user_id = auth.uid() or public.is_admin())
with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "integrations_owner_all" on public.integration_connections;
create policy "integrations_owner_all"
on public.integration_connections for all
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- ==============================================================================
-- FASE 4: INTEGRATIONS & STRUCTURED ACTIVITY RECEIVER SCHEMA
-- ==============================================================================

-- 1. INTEGRATIONS TABLE
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null, -- 'github', 'vercel', 'supabase', 'google', 'claude'
  is_enabled boolean default false,
  encrypted_config text,  -- Encrypted API token/secret with AES-256-GCM
  iv text,
  auth_tag text,
  status text default 'disconnected', -- 'connected', 'disconnected', 'error'
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_provider unique (user_id, provider)
);

alter table integrations enable row level security;
create policy "Users manage own integrations" on integrations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger integrations_updated_at before update on integrations
  for each row execute function handle_updated_at();

-- 2. INTEGRATION TOKENS (Hashed Bearer Tokens for External Webhooks / Claude)
create table if not exists integration_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  token_hash text not null, -- SHA-256 hash of the bearer token
  created_at timestamptz default now()
);

alter table integration_tokens enable row level security;
create policy "Users manage own integration_tokens" on integration_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. INDEXES
create index if not exists idx_integrations_user on integrations (user_id);
create index if not exists idx_integration_tokens_hash on integration_tokens (token_hash);

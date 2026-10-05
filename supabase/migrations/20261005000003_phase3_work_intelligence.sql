-- ==============================================================================
-- FASE 3: WORK INTELLIGENCE SCHEMA & STRUCTURED ACTIVITY LOG
-- ==============================================================================

-- 1. EXTEND ACTIVITY LOGS TABLE
alter table activity_logs
  add column if not exists application_id uuid references applications on delete set null,
  add column if not exists task_id uuid references tasks on delete set null,
  add column if not exists activity_type text default 'development',
  add column if not exists files_changed text[] default '{}',
  add column if not exists status text default 'completed';

-- 2. INDEXES
create index if not exists idx_activity_app on activity_logs (application_id);
create index if not exists idx_activity_task on activity_logs (task_id);
create index if not exists idx_activity_type on activity_logs (activity_type);

-- 3. AI CHAT SESSIONS & MESSAGES (Optional caching of AI conversations)
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text default 'Percakapan AI',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table ai_conversations enable row level security;
create policy "Users manage own ai_conversations" on ai_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger ai_conversations_updated_at before update on ai_conversations
  for each row execute function handle_updated_at();

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz default now()
);

alter table ai_messages enable row level security;
create policy "Users manage own ai_messages" on ai_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_ai_messages_conv on ai_messages (conversation_id, created_at asc);

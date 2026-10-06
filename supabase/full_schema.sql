-- ==============================================================================
-- MY WORKSPACE: COMPLETE DATABASE SCHEMA (FASE 1 - 4)
-- Jalankan seluruh script ini di Supabase SQL Editor untuk setup awal
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ------------------------------------------------------------------------------
-- 2. ENUMS & TYPES
-- ------------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type project_status as enum ('planning', 'development', 'testing', 'production', 'maintenance', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'app_type') then
    create type app_type as enum ('nextjs', 'apps_script', 'pwa', 'streamlit', 'static', 'backend', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'resource_category') then
    create type resource_category as enum ('github', 'supabase', 'vercel', 'apps_script', 'google_sheet', 'google_drive', 'figma', 'postman', 'documentation', 'production', 'staging', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('todo', 'in_progress', 'done');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type task_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_source') then
    create type task_source as enum ('manual', 'ai', 'claude', 'whatsapp');
  end if;
  if not exists (select 1 from pg_type where typname = 'credential_type') then
    create type credential_type as enum ('password', 'api_key', 'token', 'service_role_key', 'recovery_code', 'secret');
  end if;
  if not exists (select 1 from pg_type where typname = 'audit_action') then
    create type audit_action as enum ('create', 'reveal', 'copy', 'update', 'delete');
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. HELPER FUNCTION FOR UPDATED_AT
-- ------------------------------------------------------------------------------
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------------------------
-- 4. CORE TABLES (FASE 1)
-- ------------------------------------------------------------------------------

-- SERVICES
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  slug text not null,
  category text default 'other',
  icon text,
  website_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_service_slug unique (user_id, slug)
);
alter table services enable row level security;
drop policy if exists "Users manage own services" on services;
create policy "Users manage own services" on services for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists services_updated_at on services;
create trigger services_updated_at before update on services for each row execute function handle_updated_at();

-- ACCOUNTS
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  email text not null,
  label text,
  service_id uuid references services on delete set null,
  username text,
  phone text,
  purpose_tags text[] default '{}',
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table accounts enable row level security;
drop policy if exists "Users manage own accounts" on accounts;
create policy "Users manage own accounts" on accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists accounts_updated_at on accounts;
create trigger accounts_updated_at before update on accounts for each row execute function handle_updated_at();

-- PROJECTS
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status project_status default 'development',
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_project_slug unique (user_id, slug)
);
alter table projects enable row level security;
drop policy if exists "Users manage own projects" on projects;
create policy "Users manage own projects" on projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at before update on projects for each row execute function handle_updated_at();

-- APPLICATIONS
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid references projects on delete cascade,
  name text not null,
  slug text not null,
  app_type app_type default 'nextjs',
  description text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_project_app_slug unique (project_id, slug)
);
alter table applications enable row level security;
drop policy if exists "Users manage own applications" on applications;
create policy "Users manage own applications" on applications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists applications_updated_at on applications;
create trigger applications_updated_at before update on applications for each row execute function handle_updated_at();

-- RESOURCES
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  category resource_category not null,
  url text,
  service_id uuid references services on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table resources enable row level security;
drop policy if exists "Users manage own resources" on resources;
create policy "Users manage own resources" on resources for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists resources_updated_at on resources;
create trigger resources_updated_at before update on resources for each row execute function handle_updated_at();

-- RELATION JUNCTIONS (Many-to-Many)
create table if not exists project_accounts (
  project_id uuid not null references projects on delete cascade,
  account_id uuid not null references accounts on delete cascade,
  role text default 'owner',
  created_at timestamptz default now(),
  primary key (project_id, account_id)
);
alter table project_accounts enable row level security;
drop policy if exists "Users manage own project_accounts" on project_accounts;
create policy "Users manage own project_accounts" on project_accounts for all using (
  exists (select 1 from projects where id = project_accounts.project_id and user_id = auth.uid())
);

create table if not exists application_accounts (
  application_id uuid not null references applications on delete cascade,
  account_id uuid not null references accounts on delete cascade,
  role text default 'owner',
  created_at timestamptz default now(),
  primary key (application_id, account_id)
);
alter table application_accounts enable row level security;
drop policy if exists "Users manage own application_accounts" on application_accounts;
create policy "Users manage own application_accounts" on application_accounts for all using (
  exists (select 1 from applications where id = application_accounts.application_id and user_id = auth.uid())
);

create table if not exists project_resources (
  project_id uuid not null references projects on delete cascade,
  resource_id uuid not null references resources on delete cascade,
  role text default 'primary',
  created_at timestamptz default now(),
  primary key (project_id, resource_id)
);
alter table project_resources enable row level security;
drop policy if exists "Users manage own project_resources" on project_resources;
create policy "Users manage own project_resources" on project_resources for all using (
  exists (select 1 from projects where id = project_resources.project_id and user_id = auth.uid())
);

create table if not exists application_resources (
  application_id uuid not null references applications on delete cascade,
  resource_id uuid not null references resources on delete cascade,
  role text default 'primary',
  created_at timestamptz default now(),
  primary key (application_id, resource_id)
);
alter table application_resources enable row level security;
drop policy if exists "Users manage own application_resources" on application_resources;
create policy "Users manage own application_resources" on application_resources for all using (
  exists (select 1 from applications where id = application_resources.application_id and user_id = auth.uid())
);

-- TASKS & NOTES
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid references projects on delete cascade,
  application_id uuid references applications on delete cascade,
  title text not null,
  description text,
  status task_status default 'todo',
  priority task_priority default 'medium',
  due_date date,
  source task_source default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table tasks enable row level security;
drop policy if exists "Users manage own tasks" on tasks;
create policy "Users manage own tasks" on tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at before update on tasks for each row execute function handle_updated_at();

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid references projects on delete set null,
  application_id uuid references applications on delete set null,
  title text not null,
  content text,
  tags text[] default '{}',
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table notes enable row level security;
drop policy if exists "Users manage own notes" on notes;
create policy "Users manage own notes" on notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists notes_updated_at on notes;
create trigger notes_updated_at before update on notes for each row execute function handle_updated_at();

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid references projects on delete cascade,
  application_id uuid references applications on delete set null,
  task_id uuid references tasks on delete set null,
  summary text not null,
  details jsonb,
  activity_type text default 'development',
  files_changed text[] default '{}',
  status text default 'completed',
  source text default 'manual',
  created_at timestamptz default now()
);
alter table activity_logs enable row level security;
drop policy if exists "Users manage own activity_logs" on activity_logs;
create policy "Users manage own activity_logs" on activity_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 5. VAULT & PERSONAL TABLES (FASE 2)
-- ------------------------------------------------------------------------------

create table if not exists credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  service_id uuid references services on delete set null,
  label text not null,
  identifier text,
  credential_type credential_type default 'secret',
  encrypted_value text not null,
  iv text not null,
  auth_tag text not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table credentials enable row level security;
drop policy if exists "Users manage own credentials" on credentials;
create policy "Users manage own credentials" on credentials for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists credentials_updated_at on credentials;
create trigger credentials_updated_at before update on credentials for each row execute function handle_updated_at();

create table if not exists vault_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  credential_id uuid references credentials on delete set null,
  credential_label text,
  action audit_action not null,
  created_at timestamptz default now()
);
alter table vault_audit_logs enable row level security;
drop policy if exists "Users view own vault audit logs" on vault_audit_logs;
create policy "Users view own vault audit logs" on vault_audit_logs for select using (user_id = auth.uid());
drop policy if exists "Users insert own vault audit logs" on vault_audit_logs;
create policy "Users insert own vault audit logs" on vault_audit_logs for insert with check (user_id = auth.uid());

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  category text default 'general',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table documents enable row level security;
drop policy if exists "Users manage own documents" on documents;
create policy "Users manage own documents" on documents for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists documents_updated_at on documents;
create trigger documents_updated_at before update on documents for each row execute function handle_updated_at();

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  due_at timestamptz not null,
  is_completed boolean default false,
  source text default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table reminders enable row level security;
drop policy if exists "Users manage own reminders" on reminders;
create policy "Users manage own reminders" on reminders for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists reminders_updated_at on reminders;
create trigger reminders_updated_at before update on reminders for each row execute function handle_updated_at();

create table if not exists personal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  url text not null,
  tags text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table personal_links enable row level security;
drop policy if exists "Users manage own personal_links" on personal_links;
create policy "Users manage own personal_links" on personal_links for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists personal_links_updated_at on personal_links;
create trigger personal_links_updated_at before update on personal_links for each row execute function handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. WORK INTELLIGENCE & AI (FASE 3)
-- ------------------------------------------------------------------------------
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text default 'Percakapan AI',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table ai_conversations enable row level security;
drop policy if exists "Users manage own ai_conversations" on ai_conversations;
create policy "Users manage own ai_conversations" on ai_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists ai_conversations_updated_at on ai_conversations;
create trigger ai_conversations_updated_at before update on ai_conversations for each row execute function handle_updated_at();

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
drop policy if exists "Users manage own ai_messages" on ai_messages;
create policy "Users manage own ai_messages" on ai_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 7. INTEGRATIONS (FASE 4)
-- ------------------------------------------------------------------------------
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null,
  is_enabled boolean default false,
  encrypted_config text,
  iv text,
  auth_tag text,
  status text default 'disconnected',
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_provider unique (user_id, provider)
);
alter table integrations enable row level security;
drop policy if exists "Users manage own integrations" on integrations;
create policy "Users manage own integrations" on integrations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists integrations_updated_at on integrations;
create trigger integrations_updated_at before update on integrations for each row execute function handle_updated_at();

create table if not exists integration_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  token_hash text not null,
  created_at timestamptz default now()
);
alter table integration_tokens enable row level security;
drop policy if exists "Users manage own integration_tokens" on integration_tokens;
create policy "Users manage own integration_tokens" on integration_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 8. GLOBAL SEARCH INDEX VIEW (SECURITY INVOKER)
-- ------------------------------------------------------------------------------
create or replace view search_index
with (security_invoker = true) as
select
  p.id as id,
  'project' as entity_type,
  p.name as title,
  coalesce(p.description, '') as subtitle,
  '/work/projects/' || p.id as url,
  array_to_string(p.tags, ' ') || ' ' || p.slug as metadata,
  p.user_id,
  p.created_at,
  p.updated_at
from projects p

union all

select
  a.id as id,
  'application' as entity_type,
  a.name as title,
  coalesce(a.description, 'App ' || a.app_type::text) as subtitle,
  '/work/applications/' || a.id as url,
  a.app_type::text || ' ' || a.slug as metadata,
  a.user_id,
  a.created_at,
  a.updated_at
from applications a

union all

select
  r.id as id,
  'resource' as entity_type,
  r.name as title,
  coalesce(r.url, r.category::text) as subtitle,
  '/work/resources' as url,
  r.category::text || ' ' || coalesce(r.notes, '') as metadata,
  r.user_id,
  r.created_at,
  r.updated_at
from resources r

union all

select
  acc.id as id,
  'account' as entity_type,
  acc.email as title,
  coalesce(acc.label, acc.username, 'Account') as subtitle,
  '/work/accounts' as url,
  array_to_string(acc.purpose_tags, ' ') || ' ' || coalesce(acc.notes, '') as metadata,
  acc.user_id,
  acc.created_at,
  acc.updated_at
from accounts acc

union all

select
  t.id as id,
  'task' as entity_type,
  t.title as title,
  t.status::text || ' • ' || t.priority::text as subtitle,
  '/work/tasks' as url,
  coalesce(t.description, '') as metadata,
  t.user_id,
  t.created_at,
  t.updated_at
from tasks t

union all

select
  n.id as id,
  'note' as entity_type,
  n.title as title,
  case when length(n.content) > 100 then substring(n.content from 1 for 100) || '...' else coalesce(n.content, '') end as subtitle,
  '/personal/notes/' || n.id as url,
  array_to_string(n.tags, ' ') as metadata,
  n.user_id,
  n.created_at,
  n.updated_at
from notes n;

-- ------------------------------------------------------------------------------
-- 9. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
create index if not exists idx_services_user on services (user_id);
create index if not exists idx_accounts_user on accounts (user_id);
create index if not exists idx_projects_user on projects (user_id);
create index if not exists idx_applications_user on applications (user_id);
create index if not exists idx_applications_project on applications (project_id);
create index if not exists idx_resources_user on resources (user_id);
create index if not exists idx_tasks_user_status on tasks (user_id, status);
create index if not exists idx_notes_user on notes (user_id, created_at desc);
create index if not exists idx_activity_user on activity_logs (user_id, created_at desc);
create index if not exists idx_credentials_user on credentials (user_id, created_at desc);
create index if not exists idx_vault_audit_user on vault_audit_logs (user_id, created_at desc);
create index if not exists idx_documents_user on documents (user_id, created_at desc);
create index if not exists idx_reminders_user_due on reminders (user_id, is_completed, due_at);
create index if not exists idx_personal_links_user on personal_links (user_id, created_at desc);
create index if not exists idx_integrations_user on integrations (user_id);
create index if not exists idx_integration_tokens_hash on integration_tokens (token_hash);
create index if not exists idx_ai_messages_conv on ai_messages (conversation_id, created_at asc);

-- ------------------------------------------------------------------------------
-- 10. STORAGE BUCKET (Private Documents)
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload own documents to storage" on storage.objects;
create policy "Users can upload own documents to storage"
on storage.objects for insert
with check (bucket_id = 'documents' and (auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "Users can view own documents in storage" on storage.objects;
create policy "Users can view own documents in storage"
on storage.objects for select
using (bucket_id = 'documents' and (auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own documents in storage" on storage.objects;
create policy "Users can delete own documents in storage"
on storage.objects for delete
using (bucket_id = 'documents' and (auth.uid())::text = (storage.foldername(name))[1]);

-- ==============================================================================
-- FASE 1: CORE WORKSPACE SCHEMA & RLS
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- 2. ENUMS
create type project_status as enum (
  'planning',
  'development',
  'testing',
  'production',
  'maintenance',
  'archived'
);

create type app_type as enum (
  'nextjs',
  'apps_script',
  'pwa',
  'streamlit',
  'static',
  'backend',
  'other'
);

create type resource_category as enum (
  'github',
  'supabase',
  'vercel',
  'apps_script',
  'google_sheet',
  'google_drive',
  'figma',
  'postman',
  'documentation',
  'production',
  'staging',
  'other'
);

create type task_status as enum (
  'todo',
  'in_progress',
  'done'
);

create type task_priority as enum (
  'low',
  'medium',
  'high',
  'urgent'
);

create type task_source as enum (
  'manual',
  'ai',
  'claude',
  'whatsapp',
  'activity'
);

create type note_scope as enum (
  'personal',
  'work',
  'project'
);

-- 3. UPDATED_AT TRIGGER FUNCTION
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 4. PROFILES TABLE
create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text,
  role_label text default 'Owner',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (user_id = auth.uid());
create policy "Users can update own profile" on profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can insert own profile" on profiles for insert with check (user_id = auth.uid());

-- Trigger for auth.users creation
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, display_name, role_label)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'User'),
    'Owner'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 5. PROJECTS
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  description text,
  status project_status default 'planning',
  progress int default 0 check (progress between 0 and 100),
  category text,
  tech_stack text[] default '{}',
  last_opened_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;
create policy "Users manage own projects" on projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger projects_updated_at before update on projects
  for each row execute function handle_updated_at();

-- 6. APPLICATIONS
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid references projects on delete cascade,
  name text not null,
  type app_type default 'other',
  framework text,
  production_url text,
  staging_url text,
  status project_status default 'development',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table applications enable row level security;
create policy "Users manage own applications" on applications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger applications_updated_at before update on applications
  for each row execute function handle_updated_at();

-- 7. SERVICES
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  slug text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table services enable row level security;
create policy "Users manage own services" on services for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger services_updated_at before update on services
  for each row execute function handle_updated_at();

-- 8. ACCOUNTS
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  service_id uuid references services on delete set null,
  label text not null,
  identifier text not null,
  notes text,
  is_personal boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table accounts enable row level security;
create policy "Users manage own accounts" on accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger accounts_updated_at before update on accounts
  for each row execute function handle_updated_at();

-- 9. RESOURCES
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  url text not null,
  category resource_category default 'other',
  account_id uuid references accounts on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table resources enable row level security;
create policy "Users manage own resources" on resources for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger resources_updated_at before update on resources
  for each row execute function handle_updated_at();

-- 10. TASKS
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text,
  status task_status default 'todo',
  priority task_priority default 'medium',
  due_date date,
  project_id uuid references projects on delete set null,
  application_id uuid references applications on delete set null,
  source task_source default 'manual',
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks enable row level security;
create policy "Users manage own tasks" on tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger tasks_updated_at before update on tasks
  for each row execute function handle_updated_at();

-- 11. NOTES
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  body text,
  scope note_scope default 'work',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table notes enable row level security;
create policy "Users manage own notes" on notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger notes_updated_at before update on notes
  for each row execute function handle_updated_at();

-- 12. ACTIVITY LOGS (Placeholder for Phase 1, extended in Phase 3)
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid references projects on delete set null,
  summary text not null,
  source text not null default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table activity_logs enable row level security;
create policy "Users manage own activity_logs" on activity_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger activity_logs_updated_at before update on activity_logs
  for each row execute function handle_updated_at();

-- 13. RELATION TABLES (MANY-TO-MANY)
create table if not exists project_accounts (
  project_id uuid references projects on delete cascade,
  account_id uuid references accounts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (project_id, account_id)
);
alter table project_accounts enable row level security;
create policy "Users manage own project_accounts" on project_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists project_resources (
  project_id uuid references projects on delete cascade,
  resource_id uuid references resources on delete cascade,
  role text default 'other' check (role in ('database', 'repository', 'deployment', 'legacy', 'other', '')),
  user_id uuid not null references auth.users on delete cascade,
  primary key (project_id, resource_id)
);
alter table project_resources enable row level security;
create policy "Users manage own project_resources" on project_resources for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists application_resources (
  application_id uuid references applications on delete cascade,
  resource_id uuid references resources on delete cascade,
  role text default 'other' check (role in ('database', 'repository', 'deployment', 'legacy', 'other', '')),
  user_id uuid not null references auth.users on delete cascade,
  primary key (application_id, resource_id)
);
alter table application_resources enable row level security;
create policy "Users manage own application_resources" on application_resources for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists application_accounts (
  application_id uuid references applications on delete cascade,
  account_id uuid references accounts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (application_id, account_id)
);
alter table application_accounts enable row level security;
create policy "Users manage own application_accounts" on application_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists note_links (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  user_id uuid not null references auth.users on delete cascade
);
alter table note_links enable row level security;
create policy "Users manage own note_links" on note_links for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 14. INDEXES FOR PERFORMANCE & RELATIONS
create index if not exists idx_projects_user_created on projects (user_id, created_at desc);
create index if not exists idx_applications_project on applications (project_id);
create index if not exists idx_applications_user on applications (user_id, created_at desc);
create index if not exists idx_accounts_service on accounts (service_id);
create index if not exists idx_accounts_user on accounts (user_id);
create index if not exists idx_resources_account on resources (account_id);
create index if not exists idx_resources_user on resources (user_id);
create index if not exists idx_tasks_project on tasks (project_id);
create index if not exists idx_tasks_app on tasks (application_id);
create index if not exists idx_tasks_user_status on tasks (user_id, status, due_date);
create index if not exists idx_notes_user on notes (user_id, created_at desc);
create index if not exists idx_activity_project on activity_logs (project_id);
create index if not exists idx_activity_user on activity_logs (user_id, created_at desc);
create index if not exists idx_note_links_entity on note_links (entity_type, entity_id);

-- 15. GLOBAL SEARCH VIEW (security_invoker = true)
create or replace view search_index
with (security_invoker = true) as
select
  user_id,
  'project' as entity_type,
  id as entity_id,
  name as title,
  coalesce(description, category, '') as subtitle,
  '/work/projects/' || id::text as url_path,
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '')) as search_vector
from projects
union all
select
  user_id,
  'application' as entity_type,
  id as entity_id,
  name as title,
  coalesce(framework, type::text, '') as subtitle,
  '/work/applications' as url_path,
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(framework, '') || ' ' || coalesce(production_url, '')) as search_vector
from applications
union all
select
  user_id,
  'resource' as entity_type,
  id as entity_id,
  title as title,
  coalesce(url, category::text, '') as subtitle,
  '/work/resources' as url_path,
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(notes, '')) as search_vector
from resources
union all
select
  user_id,
  'account' as entity_type,
  id as entity_id,
  label as title,
  coalesce(identifier, notes, '') as subtitle,
  '/work/accounts' as url_path,
  to_tsvector('simple', coalesce(label, '') || ' ' || coalesce(identifier, '') || ' ' || coalesce(notes, '')) as search_vector
from accounts
union all
select
  user_id,
  'task' as entity_type,
  id as entity_id,
  title as title,
  coalesce(description, status::text, '') as subtitle,
  '/work/tasks' as url_path,
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')) as search_vector
from tasks
union all
select
  user_id,
  'note' as entity_type,
  id as entity_id,
  coalesce(title, 'Catatan tanpa judul') as title,
  coalesce(substring(body from 1 for 100), '') as subtitle,
  '/personal/notes' as url_path,
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, '')) as search_vector
from notes;

-- 16. RPC: search_workspace (security invoker + explicit user_id filter)
create or replace function search_workspace(q text)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text,
  url_path text,
  rank real
)
language plpgsql
security invoker
as $$
declare
  clean_q text;
begin
  if q is null or trim(q) = '' then
    return;
  end if;

  clean_q := trim(q);

  return query
  with ranked as (
    select
      s.entity_type,
      s.entity_id,
      s.title,
      s.subtitle,
      s.url_path,
      (
        ts_rank_cd(s.search_vector, plainto_tsquery('simple', clean_q)) * 2.0 +
        similarity(s.title, clean_q)
      )::real as rank,
      row_number() over (
        partition by s.entity_type
        order by (
          ts_rank_cd(s.search_vector, plainto_tsquery('simple', clean_q)) * 2.0 +
          similarity(s.title, clean_q)
        ) desc
      ) as rn
    from search_index s
    where s.user_id = auth.uid()
      and (
        s.search_vector @@ plainto_tsquery('simple', clean_q)
        or s.title ilike '%' || clean_q || '%'
        or s.subtitle ilike '%' || clean_q || '%'
      )
  )
  select
    r.entity_type,
    r.entity_id,
    r.title,
    r.subtitle,
    r.url_path,
    r.rank
  from ranked r
  where r.rn <= 5
  order by r.entity_type, r.rank desc;
end;
$$;

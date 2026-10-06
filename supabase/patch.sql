-- ==============================================================================
-- SUPABASE SCHEMA PATCH: ADD RICH COLUMNS
-- Jalankan query ini di Supabase SQL Editor
-- ==============================================================================

-- 1. Projects
alter table projects
  add column if not exists progress integer default 0,
  add column if not exists category text,
  add column if not exists tech_stack text[] default '{}',
  add column if not exists last_opened_at timestamptz default now();

-- 2. Applications
alter table applications
  add column if not exists type text default 'nextjs',
  add column if not exists framework text,
  add column if not exists production_url text,
  add column if not exists staging_url text;

-- 3. Accounts
alter table accounts
  add column if not exists identifier text,
  add column if not exists is_personal boolean default false;

-- 4. Resources
alter table resources
  add column if not exists title text,
  add column if not exists account_id uuid references accounts on delete set null;

-- 5. Notes
alter table notes
  add column if not exists body text,
  add column if not exists scope text default 'work';

-- Reload Schema Cache
notify pgrst, 'reload schema';

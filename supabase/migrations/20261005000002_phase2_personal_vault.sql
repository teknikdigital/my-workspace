-- ==============================================================================
-- FASE 2: PERSONAL & VAULT SCHEMA & RLS
-- ==============================================================================

-- 1. ENUMS
create type credential_type as enum (
  'password',
  'api_key',
  'token',
  'service_role_key',
  'recovery_code',
  'secret'
);

create type audit_action as enum (
  'create',
  'reveal',
  'copy',
  'update',
  'delete'
);

-- 2. CREDENTIALS TABLE (AES-256-GCM Encrypted values)
create table if not exists credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  service_id uuid references services on delete set null,
  label text not null,
  identifier text, -- username / email / key-name (metadata only)
  credential_type credential_type default 'secret',
  encrypted_value text not null, -- Hex encoded ciphertext
  iv text not null,              -- Hex encoded 12-byte IV
  auth_tag text not null,        -- Hex encoded 16-byte Auth Tag
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table credentials enable row level security;
create policy "Users manage own credentials" on credentials
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger credentials_updated_at before update on credentials
  for each row execute function handle_updated_at();

-- 3. VAULT AUDIT LOGS (Zero Secret Value Logged)
create table if not exists vault_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  credential_id uuid references credentials on delete set null,
  credential_label text,
  action audit_action not null,
  created_at timestamptz default now()
);

alter table vault_audit_logs enable row level security;
create policy "Users view own vault audit logs" on vault_audit_logs
  for select using (user_id = auth.uid());
create policy "Users insert own vault audit logs" on vault_audit_logs
  for insert with check (user_id = auth.uid());

-- 4. DOCUMENTS TABLE (Supabase Storage reference)
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
create policy "Users manage own documents" on documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger documents_updated_at before update on documents
  for each row execute function handle_updated_at();

-- 5. REMINDERS TABLE
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
create policy "Users manage own reminders" on reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger reminders_updated_at before update on reminders
  for each row execute function handle_updated_at();

-- 6. PERSONAL LINKS TABLE
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
create policy "Users manage own personal_links" on personal_links
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger personal_links_updated_at before update on personal_links
  for each row execute function handle_updated_at();

-- 7. INDEXES
create index if not exists idx_credentials_user on credentials (user_id, created_at desc);
create index if not exists idx_vault_audit_user on vault_audit_logs (user_id, created_at desc);
create index if not exists idx_documents_user on documents (user_id, created_at desc);
create index if not exists idx_reminders_user_due on reminders (user_id, is_completed, due_at);
create index if not exists idx_personal_links_user on personal_links (user_id, created_at desc);

-- 8. STORAGE BUCKET FOR DOCUMENTS (Private)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Users can upload own documents to storage"
on storage.objects for insert
with check (bucket_id = 'documents' and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "Users can view own documents in storage"
on storage.objects for select
using (bucket_id = 'documents' and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "Users can delete own documents in storage"
on storage.objects for delete
using (bucket_id = 'documents' and (auth.uid())::text = (storage.foldername(name))[1]);

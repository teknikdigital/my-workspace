-- ==============================================================================
-- SUPABASE SCHEMA PATCH v2: VAULT + RICH COLUMNS
-- Jalankan query ini di Supabase SQL Editor
-- ==============================================================================

-- =============================================
-- BAGIAN A: ENUM TYPES (untuk Vault)
-- =============================================
DO $$ BEGIN
  CREATE TYPE credential_type AS ENUM (
    'password', 'api_key', 'token', 'service_role_key', 'recovery_code', 'secret'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'create', 'reveal', 'copy', 'update', 'delete'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- BAGIAN B: TABEL CREDENTIALS (Encrypted Vault)
-- =============================================
CREATE TABLE IF NOT EXISTS credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  service_id uuid REFERENCES services ON DELETE SET NULL,
  label text NOT NULL,
  identifier text,
  credential_type credential_type DEFAULT 'secret',
  encrypted_value text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own credentials" ON credentials
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- BAGIAN C: VAULT AUDIT LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS vault_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  credential_id uuid REFERENCES credentials ON DELETE SET NULL,
  credential_label text,
  action audit_action NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vault_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own vault audit logs" ON vault_audit_logs
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own vault audit logs" ON vault_audit_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- BAGIAN D: DOCUMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own documents" ON documents
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- BAGIAN E: REMINDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  is_completed boolean DEFAULT false,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own reminders" ON reminders
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- BAGIAN F: PERSONAL LINKS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS personal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  tags text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE personal_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own personal_links" ON personal_links
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- BAGIAN G: RICH COLUMNS TAMBAHAN
-- =============================================

-- Projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tech_stack text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz DEFAULT now();

-- Applications
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'nextjs',
  ADD COLUMN IF NOT EXISTS framework text,
  ADD COLUMN IF NOT EXISTS production_url text,
  ADD COLUMN IF NOT EXISTS staging_url text;

-- Accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS identifier text,
  ADD COLUMN IF NOT EXISTS is_personal boolean DEFAULT false;

-- Resources
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts ON DELETE SET NULL;

-- Notes
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'work';

-- =============================================
-- BAGIAN H: INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_audit_user ON vault_audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON reminders (user_id, is_completed, due_at);
CREATE INDEX IF NOT EXISTS idx_personal_links_user ON personal_links (user_id, created_at DESC);

-- =============================================
-- BAGIAN I: STORAGE BUCKET
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';

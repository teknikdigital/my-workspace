-- Antrian Claude Code dari Telegram/WhatsApp (dijalankan oleh agent lokal di laptop).
-- Alur: AI menyiapkan kartu (draft) -> pengguna menekan "Jalankan" di Telegram (queued)
--       -> agent laptop mengambil (running) -> agent melapor hasil (done/error/...).
-- Aman dijalankan ulang. Jalankan di SQL Editor project My Workspace.

create table if not exists public.claude_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project text not null,
  instruction text not null,
  mode text not null default 'read',
  model text not null default 'sonnet',
  status text not null default 'draft',
  source text not null default 'telegram',
  conversation_id uuid,
  task_id text,
  chat_id bigint,
  message_id bigint,
  result_summary text,
  result_files jsonb,
  error text,
  cost_usd numeric,
  created_at timestamptz not null default now(),
  queued_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
);

alter table public.claude_jobs drop constraint if exists claude_jobs_mode_check;
alter table public.claude_jobs add constraint claude_jobs_mode_check check (mode in ('read', 'edit'));
alter table public.claude_jobs drop constraint if exists claude_jobs_status_check;
alter table public.claude_jobs add constraint claude_jobs_status_check check (status in ('draft', 'queued', 'running', 'done', 'error', 'stopped', 'timeout', 'cancelled', 'expired'));

create index if not exists claude_jobs_queue_idx on public.claude_jobs (user_id, status, queued_at);

alter table public.claude_jobs enable row level security;
drop policy if exists "claude_jobs_owner_all" on public.claude_jobs;
create policy "claude_jobs_owner_all" on public.claude_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tanda agent laptop masih hidup (diperbarui setiap agent memeriksa antrian).
create table if not exists public.claude_agent_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  version text
);

alter table public.claude_agent_status enable row level security;
drop policy if exists "claude_agent_status_owner_read" on public.claude_agent_status;
create policy "claude_agent_status_owner_read" on public.claude_agent_status for select using (auth.uid() = user_id);

notify pgrst, 'reload schema';

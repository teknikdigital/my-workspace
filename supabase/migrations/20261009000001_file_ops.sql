-- File ops laptop via antrian (mode 'file'): Muse/WhatsApp -> claude_jobs -> agent laptop.
-- Aman dijalankan ulang. Jalankan di SQL Editor project My Workspace.

-- 1. Izinkan mode 'file' di claude_jobs
alter table public.claude_jobs drop constraint if exists claude_jobs_mode_check;
alter table public.claude_jobs add constraint claude_jobs_mode_check check (mode in ('read', 'edit', 'file'));

-- 2. Audit setiap operasi file
create table if not exists public.file_ops_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.claude_jobs(id) on delete set null,
  op text not null check (op in ('read', 'write', 'list')),
  path text not null,
  bytes bigint,
  status text not null default 'done' check (status in ('done', 'error')),
  error text,
  created_at timestamptz not null default now()
);

alter table public.file_ops_log enable row level security;
drop policy if exists "file_ops_log_owner_all" on public.file_ops_log;
create policy "file_ops_log_owner_all" on public.file_ops_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists file_ops_log_user_idx on public.file_ops_log (user_id, created_at desc);

-- 3. Bucket private untuk file biner perantara agent <-> Muse
insert into storage.buckets (id, name, public)
values ('agent-blobs', 'agent-blobs', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

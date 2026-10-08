-- Fitur "lanjutkan" untuk antrian Claude Code: simpan ID sesi Claude tiap job agar perintah berikutnya
-- di project yang sama bisa meneruskan sesi itu (claude --resume). Aman dijalankan ulang.
-- Jalankan di SQL Editor project My Workspace (setelah 20261008000001_claude_jobs.sql).

alter table public.claude_jobs add column if not exists session_id text;
alter table public.claude_jobs add column if not exists resume_session_id text;
create index if not exists claude_jobs_project_idx on public.claude_jobs (user_id, project, finished_at desc);

notify pgrst, 'reload schema';

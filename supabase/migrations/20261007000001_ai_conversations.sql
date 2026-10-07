-- Riwayat chat AI Assistant (percakapan + pesan). Jalankan sekali di Supabase SQL Editor project My Workspace.
-- Aman dijalankan ulang. Cocok untuk database baru maupun database yang sudah punya tabel
-- ai_conversations / ai_messages versi awal (full_schema.sql): kolom yang kurang ditambahkan, data lama tidak diubah.
-- Isi pesan yang disimpan sudah disamarkan (password tidak pernah tersimpan di sini).

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null default 'Percakapan baru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_conversations add column if not exists pinned boolean not null default false;
alter table public.ai_conversations add column if not exists last_message_at timestamptz not null default now();
alter table public.ai_conversations enable row level security;

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.ai_messages add column if not exists claude_tasks jsonb;
alter table public.ai_messages enable row level security;

create index if not exists ai_conversations_user_last_idx on public.ai_conversations (user_id, pinned desc, last_message_at desc);
create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

drop policy if exists "Users manage own ai_conversations" on public.ai_conversations;
create policy "Users manage own ai_conversations" on public.ai_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own ai_messages" on public.ai_messages;
create policy "Users manage own ai_messages" on public.ai_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid() and conversation_id in (select id from public.ai_conversations where user_id = auth.uid()));

-- Segarkan cache API Supabase agar kolom baru langsung terbaca
notify pgrst, 'reload schema';

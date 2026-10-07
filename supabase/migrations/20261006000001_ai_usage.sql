-- =============================================
-- AI usage tracking (pembatas biaya AI Assistant)
-- Jalankan sekali di Supabase SQL Editor.
-- =============================================
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx on ai_usage (user_id, created_at desc);

alter table ai_usage enable row level security;
drop policy if exists "Users manage own ai_usage" on ai_usage;
create policy "Users manage own ai_usage" on ai_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

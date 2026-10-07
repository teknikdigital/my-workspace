-- WhatsApp: pencatat id pesan yang sudah diproses (Meta bisa mengirim ulang webhook yang sama).
-- Hanya diakses server (service role); RLS aktif tanpa policy = tertutup untuk klien.
create table if not exists public.whatsapp_inbound (
  message_id text primary key,
  created_at timestamptz not null default now()
);
alter table public.whatsapp_inbound enable row level security;
create index if not exists whatsapp_inbound_created_idx on public.whatsapp_inbound (created_at);

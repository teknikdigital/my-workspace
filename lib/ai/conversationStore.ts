/**
 * Penyimpanan riwayat chat AI Assistant di Supabase (tabel ai_conversations + ai_messages).
 * Dipakai service.ts (simpan tiap tanya-jawab) dan lib/actions/aiChats.ts (daftar, buka, ganti nama, hapus).
 *
 * - Yang disimpan hanya teks yang SUDAH disamarkan (rahasia -> placeholder tersamar, isi file diringkas).
 * - Bila migration belum dijalankan, semua fungsi gagal dengan aman (available = false), chat tetap jalan.
 * - Fungsi DB menerima client Supabase sebagai parameter agar mudah diuji (tests/aiConversations.test.ts).
 */

import type { ClaudeTaskDraft } from "@/lib/ai/claudeTask";

export const RETENTION_DAYS = 180;
const MAX_TITLE = 60;

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  last_message_at: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  claudeTasks?: ClaudeTaskDraft[];
}

/** Error karena tabel belum ada (migration belum dijalankan). */
export function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42P01" || err.code === "PGRST205" || /does not exist|could not find the table/i.test(err.message || "");
}

/** Judul otomatis dari pesan pertama: tanpa blok file / ringkasan lampiran, maks 60 karakter di batas kata. */
export function makeTitle(text: string): string {
  const cleaned = String(text || "")
    .replace(/\[ISI FILE:[\s\S]*?\[\/ISI FILE\]/g, " ")
    .replace(/^\s*(📎|File tersimpan|Saya mengirim file).*$/gim, " ")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Percakapan baru";
  if (cleaned.length <= MAX_TITLE) return cleaned;
  const cut = cleaned.slice(0, MAX_TITLE);
  const space = cut.lastIndexOf(" ");
  return `${(space > 30 ? cut.slice(0, space) : cut).trim()}…`;
}

export function retentionCutoff(now = new Date()): string {
  return new Date(now.getTime() - RETENTION_DAYS * 86400000).toISOString();
}

/** Bersihkan field draf Claude yang disimpan (hindari data liar dari klien). */
export function sanitizeTasks(tasks: unknown): ClaudeTaskDraft[] | null {
  if (!Array.isArray(tasks) || !tasks.length) return null;
  const out: ClaudeTaskDraft[] = [];
  for (const t of tasks.slice(0, 5) as any[]) {
    if (!t || typeof t.id !== "string" || typeof t.instruction !== "string") continue;
    out.push({
      id: t.id.slice(0, 40),
      project: String(t.project || "").slice(0, 120),
      instruction: t.instruction.slice(0, 12000),
      mode: t.mode === "read" ? "read" : "edit",
      model: ["sonnet", "opus", "haiku"].includes(t.model) ? t.model : "sonnet",
      ...(t.lastRun ? { lastRun: sanitizeLastRun(t.lastRun) } : {}),
    });
  }
  return out.length ? out : null;
}

export function sanitizeLastRun(r: any): NonNullable<ClaudeTaskDraft["lastRun"]> {
  return {
    status: ["done", "error", "stopped", "timeout"].includes(r?.status) ? r.status : "error",
    summary: r?.summary ? String(r.summary).slice(0, 300) : null,
    files: Array.isArray(r?.files) ? r.files.slice(0, 50).map((f: unknown) => String(f).slice(0, 200)) : [],
    finishedAt: Number(r?.finishedAt) || Date.now(),
    costUsd: typeof r?.costUsd === "number" ? r.costUsd : null,
  };
}

type Db = any; // client Supabase (server)

/**
 * Simpan satu tanya-jawab. Membuat percakapan baru bila conversationId kosong/tidak ditemukan.
 * Mengembalikan id percakapan + id pesan, atau { available: false } bila tabel belum ada.
 */
export async function persistExchange(
  db: Db,
  userId: string,
  input: { conversationId?: string | null; userContent: string; assistantContent: string; claudeTasks?: ClaudeTaskDraft[] }
): Promise<
  | { available: true; conversationId: string; userMessageId: string; assistantMessageId: string; created: boolean; title: string }
  | { available: false; error?: string }
> {
  let conversationId = input.conversationId || null;
  let created = false;
  let title = "";
  const now = new Date();

  if (conversationId) {
    const { data, error } = await db.from("ai_conversations").select("id, title").eq("id", conversationId).maybeSingle();
    if (isMissingTable(error)) return { available: false };
    if (!data) conversationId = null;
    else title = data.title;
  }
  if (!conversationId) {
    title = makeTitle(input.userContent);
    const { data, error } = await db
      .from("ai_conversations")
      .insert({ user_id: userId, title, last_message_at: now.toISOString() })
      .select("id")
      .single();
    if (error) return { available: false, error: isMissingTable(error) ? undefined : error.message };
    conversationId = data.id;
    created = true;
  }

  // created_at berurutan agar urutan tanya -> jawab selalu benar
  const rows = [
    { conversation_id: conversationId, user_id: userId, role: "user", content: input.userContent, created_at: now.toISOString() },
    {
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content: input.assistantContent,
      claude_tasks: sanitizeTasks(input.claudeTasks),
      created_at: new Date(now.getTime() + 1).toISOString(),
    },
  ];
  const { data: inserted, error: insErr } = await db.from("ai_messages").insert(rows).select("id, role");
  if (insErr) return { available: false, error: insErr.message };
  await db
    .from("ai_conversations")
    .update({ last_message_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("id", conversationId);

  const userRow = (inserted || []).find((r: any) => r.role === "user");
  const asstRow = (inserted || []).find((r: any) => r.role === "assistant");
  return {
    available: true,
    conversationId: conversationId as string,
    userMessageId: userRow?.id,
    assistantMessageId: asstRow?.id,
    created,
    title,
  };
}

/** Daftar percakapan (disematkan di atas, lalu terbaru) + bersihkan yang kedaluwarsa. */
export async function listConversations(
  db: Db,
  limit = 50
): Promise<{ available: boolean; items: ConversationSummary[]; reason?: string }> {
  const { data, error } = await db
    .from("ai_conversations")
    .select("id, title, pinned, last_message_at")
    .order("pinned", { ascending: false })
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) return { available: false, items: [], reason: `${error.code || ""} ${error.message || ""}`.trim() };
  // Bersihkan percakapan kedaluwarsa (tidak disematkan, > 180 hari). Gagal bersih-bersih tidak menghalangi daftar.
  const cutoff = retentionCutoff();
  const expired = (data || []).filter((c: ConversationSummary) => !c.pinned && c.last_message_at < cutoff);
  if (expired.length || (data || []).length >= limit)
    await db.from("ai_conversations").delete().eq("pinned", false).lt("last_message_at", cutoff);
  return { available: true, items: (data || []).filter((c: ConversationSummary) => !expired.includes(c)) };
}

export async function loadConversation(
  db: Db,
  id: string
): Promise<{ conversation: ConversationSummary; messages: StoredMessage[] } | null> {
  const { data: conv, error } = await db
    .from("ai_conversations")
    .select("id, title, pinned, last_message_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !conv) return null;
  const { data: msgs } = await db
    .from("ai_messages")
    .select("id, role, content, claude_tasks")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  return {
    conversation: conv,
    messages: (msgs || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      ...(m.claude_tasks ? { claudeTasks: m.claude_tasks } : {}),
    })),
  };
}

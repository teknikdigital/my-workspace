/**
 * Inti bot chat pemilik (dipakai WhatsApp & Telegram):
 *  - dedupe pesan (tabel whatsapp_inbound + memori)
 *  - percakapan per kanal "<prefix> · dd/mm/yyyy", baru otomatis setelah 12 jam diam
 *  - riwayat 12 pesan terakhir
 *  - AI Asisten yang sama dengan halaman /ai, berjalan dengan sesi & RLS pemilik (runAsUser)
 */

import { createAdminClient, createClient, runAsUser } from "@/lib/supabase/server";
import { sendAiQuery, type AiChatMessage } from "@/lib/ai/service";
import type { GeneratedFile } from "@/lib/ai/generatedFile";
import type { ClaudeTaskDraft } from "@/lib/ai/claudeTask";
import { getOwnerSession } from "./ownerSession";

const SESSION_GAP_MS = 12 * 3600 * 1000;
const seen = new Set<string>(); // cadangan dedupe bila tabel belum ada

export interface ChannelSpec {
  /** Kanal untuk AI (menentukan tool yang tersedia, mis. buat dokumen hanya di Telegram). */
  channel: "telegram" | "whatsapp";
  /** Awalan judul percakapan, mis. "📱 WhatsApp" */
  prefix: string;
  /** Ubah Markdown jawaban AI ke format kanal. Telegram mengembalikan Markdown apa adanya (diformat saat kirim). */
  format: (md: string) => string;
  /** Catatan bila AI menyiapkan kartu Claude Code. Kosongkan bila kanal mengirim kartu sendiri (Telegram). */
  claudeNote?: (projects: string) => string;
  /** Peringatan bila pesan berisi rahasia. */
  secretNote: string;
  tag: string;
}

/** true bila id pesan ini belum pernah diproses. Kunci diberi awalan per kanal (mis. "tg:123"). */
export async function firstTime(key: string): Promise<boolean> {
  if (seen.has(key)) return false;
  seen.add(key);
  if (seen.size > 2000) seen.clear();
  try {
    const { error } = await createAdminClient().from("whatsapp_inbound").insert({ message_id: key });
    if (error?.code === "23505") return false;
  } catch {
    /* tabel belum ada: pakai memori saja */
  }
  return true;
}

function todayWib() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).split("-").reverse().join("/");
}

async function currentConversation(prefix: string, forceNew: boolean, tag: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (!forceNew) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("id, last_message_at")
      .ilike("title", `${prefix}%`)
      .order("last_message_at", { ascending: false })
      .limit(1);
    const c = data?.[0];
    if (c && Date.now() - new Date(c.last_message_at).getTime() < SESSION_GAP_MS) return c.id;
  }
  const { data: created, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: user.id, title: `${prefix} · ${todayWib()}` })
    .select("id")
    .single();
  if (error) {
    console.log(`[${tag}] gagal membuat percakapan:`, error.message);
    return null;
  }
  return created.id;
}

async function history(conversationId: string | null): Promise<AiChatMessage[]> {
  if (!conversationId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(12);
  return (data || [])
    .reverse()
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => ({ role: m.role, content: m.content }));
}

export const NEW_CONVERSATION_TEXT = "Percakapan baru dimulai. Silakan tulis kebutuhan Anda.";

export interface OwnerTurnResult {
  /** Balasan teks (sudah diformat kanal). */
  text: string;
  /** File yang disiapkan AI untuk dikirim (Telegram). */
  files?: GeneratedFile[];
  /** Draf instruksi Claude Code. */
  claudeTasks?: ClaudeTaskDraft[];
  conversationId: string | null;
}

/** Jalankan fungsi dengan sesi & RLS pemilik bot. */
export async function withOwner<T>(fn: () => Promise<T>): Promise<T> {
  return runAsUser(await getOwnerSession(), fn);
}

/** Proses satu pesan pemilik. */
export async function runOwnerTurn(spec: ChannelSpec, text: string, forceNew: boolean): Promise<OwnerTurnResult> {
  return withOwner(async () => {
    const conversationId = await currentConversation(spec.prefix, forceNew, spec.tag);
    if (forceNew) return { text: NEW_CONVERSATION_TEXT, conversationId };
    const messages: AiChatMessage[] = [...(await history(conversationId)), { role: "user", content: text }];
    const res = await sendAiQuery(messages, conversationId, { channel: spec.channel });
    let out = spec.format(res.response || res.error || "Maaf, tidak ada jawaban.");
    if (res.claudeTasks?.length && spec.claudeNote) {
      const names = Array.from(new Set(res.claudeTasks.map((t) => t.project))).join(", ");
      out += "\n\n" + spec.claudeNote(names);
    }
    if (res.secretsSaved?.length || /🔒/.test(res.response || "")) out += "\n\n" + spec.secretNote;
    return { text: out, files: res.files, claudeTasks: res.claudeTasks, conversationId: res.conversation?.id || conversationId };
  });
}

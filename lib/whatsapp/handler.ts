/**
 * Memproses pesan WhatsApp masuk dari pemilik: AI Asisten yang sama dengan halaman /ai
 * (tool, data project, Activity, Claude Code), berjalan dengan sesi & RLS milik pemilik.
 * Riwayat masuk ke percakapan "📱 WhatsApp · <tanggal>" (bisa dilanjutkan dari web).
 */

import { createAdminClient, createClient, runAsUser } from "@/lib/supabase/server";
import { sendAiQuery, type AiChatMessage } from "@/lib/ai/service";
import { HELP_TEXT, normalizePhone, parseCommand, splitMessage, toWhatsAppText, type InboundMessage } from "./core";
import { getOwnerSession } from "./session";
import { markReadTyping, sendText } from "./api";

const SESSION_GAP_MS = 12 * 3600 * 1000; // lewat 12 jam tanpa pesan -> percakapan baru
const WA_PREFIX = "📱 WhatsApp";
const seen = new Set<string>(); // cadangan dedupe bila tabel belum ada

function log(...a: unknown[]) {
  console.log("[whatsapp]", ...a);
}

/** true bila pesan ini belum pernah diproses (Meta bisa mengirim ulang webhook yang sama). */
async function firstTime(messageId: string): Promise<boolean> {
  if (seen.has(messageId)) return false;
  seen.add(messageId);
  if (seen.size > 2000) seen.clear();
  try {
    const { error } = await createAdminClient().from("whatsapp_inbound").insert({ message_id: messageId });
    if (error?.code === "23505") return false; // sudah ada
  } catch {
    /* tabel belum ada: pakai memori saja */
  }
  return true;
}

function todayWib() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).split("-").reverse().join("/");
}

async function currentConversation(forceNew: boolean): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (!forceNew) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("id, last_message_at")
      .ilike("title", `${WA_PREFIX}%`)
      .order("last_message_at", { ascending: false })
      .limit(1);
    const c = data?.[0];
    if (c && Date.now() - new Date(c.last_message_at).getTime() < SESSION_GAP_MS) return c.id;
  }
  const { data: created, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: user.id, title: `${WA_PREFIX} · ${todayWib()}` })
    .select("id")
    .single();
  if (error) {
    log("gagal membuat percakapan:", error.message);
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

async function reply(to: string, text: string) {
  for (const part of splitMessage(text)) {
    const r = await sendText(to, part);
    if (!r.ok) {
      log("gagal kirim balasan:", r.status, r.error);
      break;
    }
  }
}

export async function handleInbound(msg: InboundMessage): Promise<void> {
  const owner = normalizePhone(process.env.WHATSAPP_OWNER_PHONE);
  if (!owner || msg.from !== owner) {
    log(`pesan dari nomor tidak dikenal (${msg.from.slice(0, 5)}***) diabaikan`);
    return;
  }
  if (!(await firstTime(msg.id))) return;
  // pesan lama (mis. dikirim ulang setelah server mati lama) tidak diproses
  if (msg.timestamp && Date.now() / 1000 - msg.timestamp > 15 * 60) {
    log("pesan lebih dari 15 menit diabaikan:", msg.id);
    return;
  }
  void markReadTyping(msg.id);

  if (!msg.text) {
    await reply(owner, "Saat ini lewat WhatsApp baru bisa pesan teks. Untuk file/foto, kirim lewat halaman AI di My Workspace (tombol 📎).");
    return;
  }
  const cmd = parseCommand(msg.text);
  if (cmd === "help") return reply(owner, HELP_TEXT);

  try {
    const session = await getOwnerSession();
    const text = await runAsUser(session, async () => {
      const conversationId = await currentConversation(cmd === "new");
      if (cmd === "new") return "Percakapan baru dimulai. Silakan tulis kebutuhan Anda.";
      const messages: AiChatMessage[] = [...(await history(conversationId)), { role: "user", content: msg.text! }];
      const res = await sendAiQuery(messages, conversationId);
      let out = toWhatsAppText(res.response || res.error || "Maaf, tidak ada jawaban.");
      if (res.claudeTasks?.length) {
        const names = Array.from(new Set(res.claudeTasks.map((t) => t.project))).join(", ");
        out +=
          `\n\n🛠 Instruksi Claude Code untuk *${names}* sudah disiapkan. ` +
          "Untuk menjalankan: buka My Workspace di laptop > AI > percakapan WhatsApp ini, lalu tekan *Jalankan di Claude Code*.";
      }
      if (res.secretsSaved?.length || /🔒/.test(res.response || "")) {
        out += "\n\n⚠️ Pesan WhatsApp melewati server Meta. Lain kali simpan password lewat halaman Vault di web.";
      }
      return out;
    });
    await reply(owner, text);
  } catch (e) {
    log("error:", (e as Error).message);
    await reply(owner, `Maaf, terjadi kesalahan di My Workspace: ${(e as Error).message}`.slice(0, 500));
  }
}

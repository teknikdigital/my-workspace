"use server";

/**
 * Server actions riwayat chat AI Assistant: daftar, buka, ganti nama, sematkan, hapus,
 * dan simpan status run Claude Code pada kartu instruksi. RLS membatasi ke data milik pengguna.
 */

import { createClient } from "@/lib/supabase/server";
import {
  listConversations,
  loadConversation,
  sanitizeLastRun,
  sanitizeTasks,
  type ConversationSummary,
  type StoredMessage,
} from "@/lib/ai/conversationStore";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function listAiConversations(): Promise<{ available: boolean; items: ConversationSummary[]; reason?: string }> {
  const { supabase, user } = await authed();
  if (!user) return { available: false, items: [], reason: "Sesi login tidak terbaca" };
  return listConversations(supabase);
}

export async function getAiConversation(
  id: string
): Promise<{ conversation: ConversationSummary; messages: StoredMessage[] } | null> {
  if (!UUID.test(id || "")) return null;
  const { supabase, user } = await authed();
  if (!user) return null;
  return loadConversation(supabase, id);
}

export async function renameAiConversation(id: string, title: string) {
  const t = String(title || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!UUID.test(id || "") || !t) return { success: false, error: "Judul tidak valid" };
  const { supabase, user } = await authed();
  if (!user) return { success: false, error: "Tidak terautentikasi" };
  const { error } = await supabase.from("ai_conversations").update({ title: t, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? { success: false, error: error.message } : { success: true, title: t };
}

export async function setAiConversationPinned(id: string, pinned: boolean) {
  if (!UUID.test(id || "")) return { success: false, error: "ID tidak valid" };
  const { supabase, user } = await authed();
  if (!user) return { success: false, error: "Tidak terautentikasi" };
  const { error } = await supabase.from("ai_conversations").update({ pinned: !!pinned }).eq("id", id);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteAiConversation(id: string) {
  if (!UUID.test(id || "")) return { success: false, error: "ID tidak valid" };
  const { supabase, user } = await authed();
  if (!user) return { success: false, error: "Tidak terautentikasi" };
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id); // pesan ikut terhapus (cascade)
  return error ? { success: false, error: error.message } : { success: true };
}

/** Simpan status run terakhir Claude Code ke kartu instruksi di pesan assistant. */
export async function saveClaudeTaskRun(messageId: string, taskId: string, run: unknown) {
  if (!UUID.test(messageId || "") || !taskId) return { success: false, error: "ID tidak valid" };
  const { supabase, user } = await authed();
  if (!user) return { success: false, error: "Tidak terautentikasi" };
  const { data, error } = await supabase.from("ai_messages").select("claude_tasks").eq("id", messageId).maybeSingle();
  if (error || !data) return { success: false, error: error?.message || "Pesan tidak ditemukan" };
  const tasks = sanitizeTasks(data.claude_tasks) || [];
  const lastRun = sanitizeLastRun(run);
  const next = tasks.map((t) => (t.id === taskId ? { ...t, lastRun } : t));
  const { error: upErr } = await supabase.from("ai_messages").update({ claude_tasks: next }).eq("id", messageId);
  return upErr ? { success: false, error: upErr.message } : { success: true, lastRun };
}

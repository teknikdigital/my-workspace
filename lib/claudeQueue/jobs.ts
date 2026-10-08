/**
 * Operasi job Claude Code dengan sesi PENGGUNA (RLS). Dipanggil dari bot Telegram di dalam runAsUser().
 */

import { createClient } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/ai/conversationStore";
import type { ClaudeTaskDraft } from "@/lib/ai/claudeTask";
import { AGENT_ONLINE_MS, type JobView } from "./format";

export const MIGRATION_HINT = "Antrian Claude Code belum aktif: jalankan migration 20261008000001_claude_jobs.sql di Supabase (project My Workspace).";
export const RESUME_MIGRATION_HINT = "Fitur lanjutkan belum aktif: jalankan migration 20261008000002_claude_jobs_resume.sql di Supabase (project My Workspace). Dimulai sesi baru.";

/** Sesi Claude terakhir yang tercatat untuk project ini (untuk perintah "lanjutkan"). */
async function lastSession(supabase: any, project: string): Promise<{ sessionId: string | null; note?: string }> {
  const { data, error } = await supabase
    .from("claude_jobs")
    .select("session_id")
    .ilike("project", project)
    .not("session_id", "is", null)
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) return { sessionId: null, note: /session_id|column/i.test(error.message || "") ? RESUME_MIGRATION_HINT : `Sesi sebelumnya tidak terbaca (${error.message}). Dimulai sesi baru.` };
  const id = data?.[0]?.session_id || null;
  return id ? { sessionId: id } : { sessionId: null, note: "Belum ada sesi Claude sebelumnya untuk project ini. Dimulai sesi baru." };
}

const COLS = "id, project, instruction, mode, model, status, chat_id, message_id, result_summary, result_files, error, cost_usd";

function fail(error: { code?: string; message?: string } | null | undefined, fallback: string) {
  return { ok: false as const, error: isMissingTable(error) ? MIGRATION_HINT : error?.message || fallback };
}

export async function createDraftJob(
  task: ClaudeTaskDraft,
  meta: { conversationId: string | null; chatId: number; source: "telegram" | "whatsapp" }
): Promise<{ ok: true; job: JobView; note?: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tidak terautentikasi" };
  let resume: { sessionId: string | null; note?: string } = { sessionId: null };
  if (task.continueSession) resume = await lastSession(supabase, task.project);
  const { data, error } = await supabase
    .from("claude_jobs")
    .insert({
      ...(resume.sessionId ? { resume_session_id: resume.sessionId } : {}),
      user_id: user.id,
      project: task.project,
      instruction: task.instruction,
      mode: task.mode,
      model: task.model,
      status: "draft",
      source: meta.source,
      conversation_id: meta.conversationId,
      task_id: task.id,
      chat_id: meta.chatId,
    })
    .select(COLS)
    .single();
  if (error || !data) return fail(error, "Gagal membuat job");
  return { ok: true, job: { ...(data as JobView), resume_session_id: resume.sessionId }, note: resume.note };
}

export async function setJobMessage(jobId: string, messageId: number) {
  const supabase = await createClient();
  await supabase.from("claude_jobs").update({ message_id: messageId }).eq("id", jobId);
}

/** draft -> queued. Mengembalikan job + kapan agent terakhir terlihat. */
export async function queueJob(
  jobId: string
): Promise<{ ok: true; job: JobView & { chat_id: number; message_id: number | null }; agentOnline: boolean; agentLastSeen: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claude_jobs")
    .update({ status: "queued", queued_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "draft")
    .select(COLS)
    .maybeSingle();
  if (error) return fail(error, "Gagal memasukkan antrian");
  if (!data) {
    const { data: cur } = await supabase.from("claude_jobs").select("status").eq("id", jobId).maybeSingle();
    return { ok: false, error: cur ? `Instruksi ini sudah berstatus "${cur.status}"` : "Instruksi tidak ditemukan" };
  }
  const { data: agent } = await supabase.from("claude_agent_status").select("last_seen_at").maybeSingle();
  const last = agent?.last_seen_at ? new Date(agent.last_seen_at).getTime() : 0;
  return { ok: true, job: data as any, agentOnline: Date.now() - last < AGENT_ONLINE_MS, agentLastSeen: agent?.last_seen_at || null };
}

/** draft/queued -> cancelled. Job yang sudah berjalan tidak bisa dibatalkan dari sini. */
export async function cancelJob(jobId: string): Promise<{ ok: true; job: JobView } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claude_jobs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("status", ["draft", "queued"])
    .select(COLS)
    .maybeSingle();
  if (error) return fail(error, "Gagal membatalkan");
  if (!data) return { ok: false, error: "Instruksi sudah berjalan/selesai, tidak bisa dibatalkan dari Telegram" };
  return { ok: true, job: data as JobView };
}

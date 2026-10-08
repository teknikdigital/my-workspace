/**
 * Sisi server untuk agent laptop (token integrasi, admin client, selalu difilter user_id pemilik token).
 *  - authAgent      : verifikasi "Authorization: Bearer <token integrasi>" (tabel integration_tokens, SHA-256)
 *  - claimNext      : catat detak agent, kedaluwarsakan job lama, ambil 1 job antri (atomik)
 *  - releaseJob     : kembalikan job ke antrian (project sedang sibuk)
 *  - finishJob      : simpan hasil + perbarui kartu di riwayat chat web
 */

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { sanitizeLastRun, sanitizeTasks } from "@/lib/ai/conversationStore";
import { QUEUE_TTL_MS, RUNNING_TTL_MS, normalizeResult, type JobView } from "./format";

const COLS = "id, project, instruction, mode, model, status, chat_id, message_id, conversation_id, task_id, result_summary, result_files, error, cost_usd, finished_at";

export async function authAgent(authHeader: string | null): Promise<{ userId: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data } = await createAdminClient().from("integration_tokens").select("user_id").eq("token_hash", hash).maybeSingle();
  return data?.user_id ? { userId: data.user_id } : null;
}

export type AgentJob = JobView & {
  chat_id: number | null;
  message_id: number | null;
  conversation_id: string | null;
  task_id: string | null;
};

/** Job yang berubah status karena kedaluwarsa (untuk diberi tahu ke Telegram). */
export async function sweep(userId: string): Promise<AgentJob[]> {
  const db = createAdminClient();
  const now = Date.now();
  const expired = await db
    .from("claude_jobs")
    .update({ status: "expired", finished_at: new Date(now).toISOString() })
    .eq("user_id", userId)
    .eq("status", "queued")
    .lt("queued_at", new Date(now - QUEUE_TTL_MS).toISOString())
    .select(COLS);
  const stale = await db
    .from("claude_jobs")
    .update({ status: "error", error: "Agent laptop tidak melapor hasil (laptop tidur/mati atau agent di-restart).", finished_at: new Date(now).toISOString() })
    .eq("user_id", userId)
    .eq("status", "running")
    .lt("started_at", new Date(now - RUNNING_TTL_MS).toISOString())
    .select(COLS);
  return [...((expired.data as AgentJob[]) || []), ...((stale.data as AgentJob[]) || [])];
}

export async function heartbeat(userId: string, version: string | null) {
  await createAdminClient()
    .from("claude_agent_status")
    .upsert({ user_id: userId, last_seen_at: new Date().toISOString(), version: version ? version.slice(0, 20) : null });
}

/** Ambil job antri tertua dan tandai running. Atomik: hanya satu agent yang berhasil mengubah status queued. */
export async function claimNext(userId: string): Promise<AgentJob | null> {
  const db = createAdminClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: next } = await db
      .from("claude_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "queued")
      .order("queued_at", { ascending: true })
      .limit(1);
    if (!next?.length) return null;
    const { data } = await db
      .from("claude_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", next[0].id)
      .eq("user_id", userId)
      .eq("status", "queued")
      .select(COLS)
      .maybeSingle();
    if (data) return data as AgentJob;
  }
  return null;
}

export async function releaseJob(userId: string, jobId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("claude_jobs")
    .update({ status: "queued", started_at: null })
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("status", "running")
    .select("id")
    .maybeSingle();
  return !!data;
}

export async function finishJob(userId: string, jobId: string, body: unknown): Promise<AgentJob | null> {
  const r = normalizeResult(body);
  const db = createAdminClient();
  const { data } = await db
    .from("claude_jobs")
    .update({
      status: r.status,
      result_summary: r.summary,
      result_files: r.files,
      error: r.error,
      cost_usd: r.costUsd,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("status", "running")
    .select(COLS)
    .maybeSingle();
  if (!data) return null;
  const job = data as AgentJob;
  await updateWebCard(userId, job).catch(() => {});
  return job;
}

/** Tampilkan hasil di kartu Claude Code pada riwayat chat web (ai_messages.claude_tasks[].lastRun). */
async function updateWebCard(userId: string, job: AgentJob) {
  if (!job.conversation_id || !job.task_id) return;
  const db = createAdminClient();
  const { data } = await db
    .from("ai_messages")
    .select("id, claude_tasks")
    .eq("conversation_id", job.conversation_id)
    .eq("user_id", userId)
    .eq("role", "assistant")
    .not("claude_tasks", "is", null);
  for (const m of (data || []) as any[]) {
    const tasks = sanitizeTasks(m.claude_tasks) || [];
    if (!tasks.some((t) => t.id === job.task_id)) continue;
    const lastRun = sanitizeLastRun({
      status: job.status,
      summary: job.result_summary,
      files: job.result_files,
      finishedAt: Date.now(),
      costUsd: job.cost_usd == null ? null : Number(job.cost_usd),
    });
    await db
      .from("ai_messages")
      .update({ claude_tasks: tasks.map((t) => (t.id === job.task_id ? { ...t, lastRun } : t)) })
      .eq("id", m.id);
    return;
  }
}

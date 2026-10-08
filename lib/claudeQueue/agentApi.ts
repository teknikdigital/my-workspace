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

const COLS = "id, project, instruction, mode, model, status, chat_id, message_id, conversation_id, task_id, result_summary, result_files, error, cost_usd, queued_at, finished_at";
/** + kolom fitur "lanjutkan" (migration 20261008000002). Bila belum ada, dipakai COLS saja. */
const COLS_RESUME = `${COLS}, resume_session_id`;
const missingResumeCols = (e: { message?: string } | null | undefined) => !!e && /session_id/i.test(e.message || "");

export async function authAgent(authHeader: string | null): Promise<{ userId: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data, error } = await createAdminClient().from("integration_tokens").select("user_id").eq("token_hash", hash).maybeSingle();
  // Database tidak terjangkau (mis. laptop baru bangun, jaringan belum siap) BUKAN token salah:
  // lempar error agar route membalas 503 (agent mencoba lagi 1 menit), bukan 401 (agent menunggu 5 menit + pesan menyesatkan).
  if (error) throw new Error(`cek token gagal: ${error.message}`);
  return data?.user_id ? { userId: data.user_id } : null;
}

export type AgentJob = JobView & {
  resume_session_id?: string | null;
  queued_at?: string | null;
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

/**
 * Ambil job antri tertua dan tandai running. Atomik: hanya satu agent yang berhasil mengubah status queued.
 * Mengembalikan alasan bila ada job antri tetapi gagal diambil (untuk log agent).
 */
export async function claimNext(userId: string): Promise<{ job: AgentJob | null; pending: number; reason?: string }> {
  const db = createAdminClient();
  let reason: string | undefined;
  let pending = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: next, error: selErr } = await db
      .from("claude_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "queued")
      .order("queued_at", { ascending: true })
      .limit(1);
    if (selErr) return { job: null, pending, reason: `baca antrian gagal: ${selErr.message}` };
    pending = next?.length || 0;
    if (!pending) return { job: null, pending: 0 };
    const claim = (cols: string) =>
      db
        .from("claude_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", next![0].id)
        .eq("user_id", userId)
        .eq("status", "queued")
        .select(cols)
        .maybeSingle();
    let { data, error: upErr } = await claim(COLS_RESUME);
    if (missingResumeCols(upErr)) {
      // migration "lanjutkan" belum dijalankan: RETURNING gagal sehingga update dibatalkan; ulangi tanpa kolom baru
      ({ data, error: upErr } = await claim(COLS));
    }
    if (data) return { job: data as unknown as AgentJob, pending };
    reason = upErr ? `ambil job gagal: ${upErr.message}` : "job diambil proses lain";
  }
  console.error("[claude-queue] job antri tidak terambil:", reason);
  return { job: null, pending, reason };
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

export async function finishJob(userId: string, jobId: string, body: unknown): Promise<(AgentJob & { answer: string | null }) | null> {
  const r = normalizeResult(body);
  const db = createAdminClient();
  const base = {
    status: r.status,
    result_summary: r.summary,
    result_files: r.files,
    error: r.error,
    cost_usd: r.costUsd,
    finished_at: new Date().toISOString(),
  };
  const save = (payload: Record<string, unknown>) =>
    db.from("claude_jobs").update(payload).eq("id", jobId).eq("user_id", userId).eq("status", "running").select(COLS).maybeSingle();
  let { data, error } = await save(r.sessionId ? { ...base, session_id: r.sessionId } : base);
  if (missingResumeCols(error)) ({ data, error } = await save(base));
  if (!data) return null;
  const job = data as AgentJob;
  await updateWebCard(userId, job).catch(() => {});
  return { ...job, answer: r.answer };
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

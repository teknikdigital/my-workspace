/**
 * Teks pesan Telegram untuk antrian Claude Code (Markdown, diubah ke HTML oleh lib/telegram/core.ts).
 * Murni, diuji di tests/claudeQueue.test.ts.
 */

export type JobStatus = "draft" | "queued" | "running" | "done" | "error" | "stopped" | "timeout" | "cancelled" | "expired";

export interface JobView {
  id: string;
  project: string;
  instruction: string;
  mode: string;
  model: string;
  status: JobStatus;
  result_summary?: string | null;
  result_files?: string[] | null;
  error?: string | null;
  cost_usd?: number | null;
  /** Sesi Claude sebelumnya yang diteruskan (perintah "lanjutkan"). */
  resume_session_id?: string | null;
}

/**
 * Job antri lebih lama dari ini tanpa diambil agent = kedaluwarsa.
 * Default 24 jam (perintah malam hari tetap dikerjakan saat laptop menyala pagi).
 * Bisa diubah lewat env CLAUDE_QUEUE_TTL_HOURS (1 s.d. 72).
 */
export function queueTtlHours(env: string | undefined = process.env.CLAUDE_QUEUE_TTL_HOURS): number {
  const n = Number(env);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.round(n), 72) : 24;
}
export const QUEUE_TTL_HOURS = queueTtlHours();
export const QUEUE_TTL_MS = QUEUE_TTL_HOURS * 3600 * 1000;
/** Job berjalan lebih lama dari ini tanpa laporan = dianggap gagal (agent mati / laptop tidur). */
export const RUNNING_TTL_MS = 75 * 60 * 1000;
/** Agent dianggap aktif bila memeriksa antrian dalam rentang ini. */
export const AGENT_ONLINE_MS = 2 * 60 * 1000;

const STATUS_LINE: Record<JobStatus, string> = {
  draft: "",
  queued: "⏳ **Antri**, menunggu agent di laptop.",
  running: "▶️ **Sedang dikerjakan** Claude Code di laptop.",
  done: "✅ **Selesai.**",
  error: "❌ **Gagal.**",
  stopped: "⏹ **Dihentikan.**",
  timeout: "⏱ **Melewati batas waktu.**",
  cancelled: "✖️ **Dibatalkan.**",
  expired: `⌛ **Kedaluwarsa**: agent laptop tidak aktif dalam ${QUEUE_TTL_HOURS} jam.`,
};

function clip(s: string, n: number) {
  const t = String(s || "").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Kartu instruksi di Telegram (dengan baris status di bawahnya). */
export function jobCardText(job: JobView, extra?: string): string {
  const head =
    `🛠 **Claude Code · ${job.project}** (${job.mode === "edit" ? "boleh ubah file" : "baca saja"}, ${job.model})` +
    (job.resume_session_id ? "\n↪️ Melanjutkan sesi Claude sebelumnya" : "");
  const lines = [head, "", clip(job.instruction, 900)];
  const st = STATUS_LINE[job.status];
  if (st) lines.push("", st);
  if (extra) lines.push(extra);
  return lines.join("\n");
}

export function jobButtons(jobId: string) {
  return {
    inline_keyboard: [
      [
        { text: "▶️ Jalankan", callback_data: `cq:run:${jobId}` },
        { text: "✖️ Batal", callback_data: `cq:cancel:${jobId}` },
      ],
    ],
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "cq:run:<uuid>" -> { action: "run", jobId } */
export function parseJobCallback(data: string | undefined | null): { action: "run" | "cancel"; jobId: string } | null {
  const m = String(data || "").match(/^cq:(run|cancel):(.+)$/);
  if (!m || !UUID.test(m[2])) return null;
  return { action: m[1] as "run" | "cancel", jobId: m[2] };
}

/** Pesan saat job yang menunggu laptop offline akhirnya diambil agent (memicu notifikasi HP). */
export function jobStartedText(job: Pick<JobView, "project"> & { queued_at?: string | null }, now = Date.now()): string {
  const waited = job.queued_at ? Math.max(0, now - Date.parse(job.queued_at)) : 0;
  const mins = Math.round(waited / 60000);
  const dur = mins >= 90 ? `${Math.round(mins / 60)} jam` : `${mins} menit`;
  return `▶️ Laptop online. Claude Code mulai mengerjakan **${job.project}**${mins >= 1 ? ` (menunggu ${dur})` : ""}.`;
}

/** Batas jawaban lengkap Claude yang diteruskan ke Telegram (sisanya dibaca di laptop). */
export const MAX_ANSWER_CHARS = 12_000;

/** Pesan hasil yang dikirim setelah agent melapor. answer = jawaban lengkap Claude (Markdown). */
export function jobResultText(job: JobView, answer?: string | null): string {
  const icon = job.status === "done" ? "✅" : job.status === "stopped" ? "⏹" : job.status === "timeout" ? "⏱" : "❌";
  const lines = [`${icon} **Claude Code ${job.status === "done" ? "selesai" : job.status === "error" ? "gagal" : job.status} · ${job.project}**`];
  const full = String(answer || "").trim();
  if (full) {
    lines.push("", full.length > MAX_ANSWER_CHARS ? `${full.slice(0, MAX_ANSWER_CHARS)}\n\n… (jawaban dipotong; versi lengkap di laptop: halaman Lokal > Claude)` : full);
  } else if (job.result_summary) lines.push("", clip(job.result_summary, 1500));
  if (job.status !== "done" && job.error) lines.push("", `Penyebab: ${clip(job.error, 600)}`);
  const files = job.result_files || [];
  if (files.length) {
    lines.push("", `File berubah (${files.length}):`);
    for (const f of files.slice(0, 12)) lines.push(`- \`${clip(f, 120)}\``);
    if (files.length > 12) lines.push(`- … ${files.length - 12} lainnya`);
  } else if (job.status === "done" && job.mode === "edit") lines.push("", "Tidak ada file yang berubah.");
  if (typeof job.cost_usd === "number") lines.push("", `Estimasi biaya: $${job.cost_usd.toFixed(3)}`);
  if (job.status === "done" && job.mode === "edit") lines.push("Cek perubahannya di laptop (git diff) sebelum push.");
  return lines.join("\n");
}

/** Validasi laporan hasil dari agent. */
export function normalizeResult(body: any): {
  status: "done" | "error" | "stopped" | "timeout";
  summary: string | null;
  files: string[];
  error: string | null;
  costUsd: number | null;
  answer: string | null;
  sessionId: string | null;
} {
  const status = ["done", "error", "stopped", "timeout"].includes(body?.status) ? body.status : "error";
  return {
    status,
    answer: body?.answer ? String(body.answer).slice(0, MAX_ANSWER_CHARS + 1) : null,
    summary: body?.summary ? String(body.summary).slice(0, 4000) : null,
    files: Array.isArray(body?.files) ? body.files.slice(0, 200).map((f: unknown) => String(f).slice(0, 300)) : [],
    error: body?.error ? String(body.error).slice(0, 2000) : null,
    sessionId: typeof body?.sessionId === "string" && /^[0-9a-f-]{8,64}$/i.test(body.sessionId) ? body.sessionId : null,
    costUsd: typeof body?.costUsd === "number" && isFinite(body.costUsd) ? body.costUsd : null,
  };
}

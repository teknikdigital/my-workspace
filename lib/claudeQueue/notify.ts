/**
 * Kabar status job Claude Code ke Telegram (best effort: gagal kirim tidak menggagalkan antrian).
 */

import { editHtml } from "@/lib/telegram/api";
import { replyMarkdown } from "@/lib/telegram/reply";
import { toTelegramHtml } from "@/lib/telegram/core";
import { AGENT_ONLINE_MS, jobCardText, jobResultText, jobStartedText } from "./format";
import type { AgentJob } from "./agentApi";

function enabled(job: AgentJob) {
  return !!(process.env.TELEGRAM_BOT_TOKEN && job.chat_id);
}

/** Perbarui kartu (status baru, tombol dihapus). */
export async function updateCard(job: AgentJob, extra?: string) {
  if (!enabled(job) || !job.message_id) return;
  await editHtml(Number(job.chat_id), Number(job.message_id), toTelegramHtml(jobCardText(job, extra)));
}

/** Kartu diperbarui + pesan hasil (dengan jawaban lengkap Claude bila ada) sebagai balasan kartu. */
export async function notifyFinished(job: AgentJob & { answer?: string | null }) {
  if (!enabled(job)) return;
  await updateCard(job);
  await replyMarkdown(Number(job.chat_id), jobResultText(job, job.answer), { replyTo: job.message_id ? Number(job.message_id) : undefined });
}

/**
 * Job diambil agent. Bila job sudah menunggu lama (laptop tadinya mati/tidur), kirim pesan balasan singkat
 * agar HP berbunyi; mengedit kartu saja tidak memicu notifikasi Telegram.
 */
export async function notifyStarted(job: AgentJob, now = Date.now()) {
  if (!enabled(job)) return;
  await updateCard(job);
  const waited = job.queued_at ? now - Date.parse(job.queued_at) : 0;
  if (waited > AGENT_ONLINE_MS)
    await replyMarkdown(Number(job.chat_id), jobStartedText(job, now), { replyTo: job.message_id ? Number(job.message_id) : undefined });
}

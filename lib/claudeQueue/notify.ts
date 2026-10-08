/**
 * Kabar status job Claude Code ke Telegram (best effort: gagal kirim tidak menggagalkan antrian).
 */

import { editHtml, sendHtml } from "@/lib/telegram/api";
import { toTelegramHtml } from "@/lib/telegram/core";
import { jobCardText, jobResultText } from "./format";
import type { AgentJob } from "./agentApi";

function enabled(job: AgentJob) {
  return !!(process.env.TELEGRAM_BOT_TOKEN && job.chat_id);
}

/** Perbarui kartu (status baru, tombol dihapus). */
export async function updateCard(job: AgentJob, extra?: string) {
  if (!enabled(job) || !job.message_id) return;
  await editHtml(Number(job.chat_id), Number(job.message_id), toTelegramHtml(jobCardText(job, extra)));
}

/** Kartu diperbarui + pesan hasil sebagai balasan kartu. */
export async function notifyFinished(job: AgentJob) {
  if (!enabled(job)) return;
  await updateCard(job);
  await sendHtml(Number(job.chat_id), toTelegramHtml(jobResultText(job)), { replyTo: job.message_id ? Number(job.message_id) : undefined });
}

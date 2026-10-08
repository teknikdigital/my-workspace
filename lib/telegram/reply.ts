/**
 * Kirim teks Markdown ke Telegram: dipotong per 3.500 karakter (blok kode tetap utuh), diformat HTML;
 * bila Telegram menolak HTML (400), bagian itu dikirim sebagai teks biasa.
 */

import { splitMarkdown } from "@/lib/chatbot/text";
import { toTelegramHtml } from "./core";
import { sendHtml, sendPlain } from "./api";

export async function replyMarkdown(chatId: number, md: string, opts: { replyTo?: number } = {}) {
  let first = true;
  for (const part of splitMarkdown(md)) {
    const o = first && opts.replyTo ? { replyTo: opts.replyTo } : {};
    let r = await sendHtml(chatId, toTelegramHtml(part), o);
    if (!r.ok && r.status === 400) r = await sendPlain(chatId, part, o);
    if (!r.ok) {
      console.log("[telegram] gagal kirim balasan:", r.status, r.error);
      break;
    }
    first = false;
  }
}

/**
 * Pengirim Telegram Bot API. Token dari env TELEGRAM_BOT_TOKEN (tidak pernah dicatat ke log).
 * TELEGRAM_API_URL hanya untuk pengujian (server tiruan).
 */

export interface TgResult {
  ok: boolean;
  status: number;
  error?: string;
  result?: any;
}

function root() {
  return (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/+$/, "");
}

function hide(msg: string, token: string) {
  return token ? msg.split(token).join("***") : msg;
}

async function parse(res: Response): Promise<TgResult> {
  const j: any = await res.json().catch(() => ({}));
  if (res.ok && j?.ok !== false) return { ok: true, status: res.status, result: j?.result };
  return { ok: false, status: res.status, error: j?.description || res.statusText };
}

export async function tgCall(method: string, body: Record<string, unknown>): Promise<TgResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN belum diisi" };
  try {
    const res = await fetch(`${root()}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await parse(res);
  } catch (e) {
    return { ok: false, status: 0, error: hide((e as Error).message, token) };
  }
}

type Markup = Record<string, unknown> | undefined;

export function sendHtml(chatId: number, html: string, opts: { replyMarkup?: Markup; replyTo?: number } = {}) {
  return tgCall("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
    ...(opts.replyTo ? { reply_parameters: { message_id: opts.replyTo, allow_sending_without_reply: true } } : {}),
  });
}

export function sendPlain(chatId: number, text: string, opts: { replyMarkup?: Markup; replyTo?: number } = {}) {
  return tgCall("sendMessage", {
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
    ...(opts.replyTo ? { reply_parameters: { message_id: opts.replyTo, allow_sending_without_reply: true } } : {}),
  });
}

/** Ubah teks pesan (mis. kartu Claude Code) dan tombolnya. replyMarkup undefined = tombol dihapus. */
export function editHtml(chatId: number, messageId: number, html: string, replyMarkup?: Markup) {
  return tgCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: replyMarkup || { inline_keyboard: [] },
  });
}

export function answerCallback(callbackId: string, text?: string) {
  return tgCall("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text: text.slice(0, 190) } : {}) });
}

/** Kirim file (multipart). */
export async function sendDocument(chatId: number, data: Buffer, fileName: string, caption?: string): Promise<TgResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN belum diisi" };
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption.slice(0, 1000));
  form.append("document", new Blob([new Uint8Array(data)]), fileName);
  try {
    const res = await fetch(`${root()}/bot${token}/sendDocument`, { method: "POST", body: form });
    return await parse(res);
  } catch (e) {
    return { ok: false, status: 0, error: hide((e as Error).message, token) };
  }
}

/** Batas unduh file Bot API: 20 MB. */
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

/** Unduh file yang dikirim pengguna (getFile -> /file/bot<token>/<path>). */
export async function downloadFile(fileId: string): Promise<{ ok: true; data: Buffer } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN belum diisi" };
  const info = await tgCall("getFile", { file_id: fileId });
  if (!info.ok || !info.result?.file_path) return { ok: false, error: info.error || "File tidak bisa diambil (maks 20 MB)" };
  try {
    const res = await fetch(`${root()}/file/bot${token}/${info.result.file_path}`);
    if (!res.ok) return { ok: false, error: `Gagal mengunduh file (${res.status})` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_DOWNLOAD_BYTES) return { ok: false, error: "File lebih dari 20 MB" };
    return { ok: true, data: buf };
  } catch (e) {
    return { ok: false, error: hide((e as Error).message, token) };
  }
}

/**
 * Tampilkan "sedang mengetik..." selama AI memproses. Telegram menghapusnya setelah ~5 detik,
 * jadi dikirim ulang tiap 4 detik. Panggil fungsi yang dikembalikan untuk berhenti.
 */
export function keepTyping(chatId: number, everyMs = 4000, action: "typing" | "upload_document" = "typing"): () => void {
  const ping = () => void tgCall("sendChatAction", { chat_id: chatId, action });
  ping();
  const t = setInterval(ping, everyMs);
  return () => clearInterval(t);
}

/**
 * Helper murni Telegram Bot API (tanpa I/O). Diuji di tests/telegram.test.ts.
 *  - verifikasi header X-Telegram-Bot-Api-Secret-Token (secret_token saat setWebhook)
 *  - ambil pesan dari Update
 *  - Markdown jawaban AI -> HTML Telegram (parse_mode "HTML")
 */

import crypto from "crypto";

/** Bandingkan header secret dengan nilai env secara aman. Secret kosong = tolak semua. */
export function verifySecret(header: string | null, expected: string | undefined): boolean {
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface TgInbound {
  updateId: number;
  messageId: number;
  chatId: number;
  chatType: string; // private | group | supergroup | channel
  fromId: number;
  fromName: string | null;
  date: number; // detik epoch
  kind: string; // text | photo | document | voice | ...
  text: string | null;
  /** Keterangan yang diketik bersama file/foto. */
  caption: string | null;
  /** File yang dikirim sebagai dokumen. */
  document: { fileId: string; fileName: string; fileSize: number; mime: string | null } | null;
}

export interface TgCallback {
  updateId: number;
  callbackId: string;
  fromId: number;
  chatId: number | null;
  messageId: number | null;
  data: string;
}

const MEDIA_KINDS = ["photo", "document", "voice", "audio", "video", "video_note", "sticker", "location", "contact", "animation"];

/** Ambil pesan baru dari Update. Pesan yang diedit, callback, dll. diabaikan (null). */
export function extractUpdate(update: any): TgInbound | null {
  const m = update?.message;
  if (!m || typeof update.update_id !== "number" || !m.chat || !m.from) return null;
  const kind = typeof m.text === "string" ? "text" : MEDIA_KINDS.find((k) => m[k] !== undefined) || "unknown";
  return {
    updateId: update.update_id,
    messageId: Number(m.message_id) || 0,
    chatId: Number(m.chat.id),
    chatType: String(m.chat.type || ""),
    fromId: Number(m.from.id),
    fromName: [m.from.first_name, m.from.last_name].filter(Boolean).join(" ") || null,
    date: Number(m.date) || 0,
    kind,
    text: kind === "text" ? String(m.text) : null,
    caption: typeof m.caption === "string" ? m.caption : null,
    document: m.document?.file_id
      ? {
          fileId: String(m.document.file_id),
          fileName: String(m.document.file_name || "file"),
          fileSize: Number(m.document.file_size) || 0,
          mime: m.document.mime_type ? String(m.document.mime_type) : null,
        }
      : null,
  };
}

/** Tekanan tombol inline (mis. "▶️ Jalankan" pada kartu Claude Code). */
export function extractCallback(update: any): TgCallback | null {
  const q = update?.callback_query;
  if (!q?.id || !q.from || typeof update.update_id !== "number") return null;
  return {
    updateId: update.update_id,
    callbackId: String(q.id),
    fromId: Number(q.from.id),
    chatId: q.message?.chat?.id != null ? Number(q.message.chat.id) : null,
    messageId: q.message?.message_id != null ? Number(q.message.message_id) : null,
    data: String(q.data || ""),
  };
}

/** "/baru", "/baru@NamaBot", "baru" -> new; "/start", "/bantuan", "menu" -> help. */
export function parseTgCommand(text: string): "new" | "help" | null {
  const t = text.trim().toLowerCase().replace(/^(\/\w+)@\w+/, "$1");
  if (/^\/?(baru|new|reset)$/.test(t)) return "new";
  if (/^\/?(start|bantuan|help|menu)$/.test(t)) return "help";
  return null;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(l: string): string {
  l = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/__(.+?)__/g, "<b>$1</b>");
  l = l.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1<i>$2</i>");
  l = l.replace(/~~(.+?)~~/g, "<s>$1</s>");
  return l;
}

function convertLine(line: string): string {
  if (/^\s*\|?\s*:?-{3,}[-|:\s]*$/.test(line)) return ""; // garis pemisah tabel
  // lindungi `kode` dan [link](url) sebelum escape & format
  const codes: string[] = [];
  const links: { t: string; u: string }[] = [];
  let l = line.replace(/`([^`\n]+)`/g, (_, c: string) => `\u0000${codes.push(c) - 1}\u0000`);
  l = l.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t: string, u: string) => `\u0001${links.push({ t, u }) - 1}\u0001`);
  l = escapeHtml(l);
  const h = l.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
  if (h) l = `<b>${h[1].replace(/\*\*/g, "").replace(/__/g, "")}</b>`;
  else l = inlineFormat(l.replace(/^(\s*)[*-]\s+/, "$1• "));
  l = l.replace(/\u0001(\d+)\u0001/g, (_, i: string) => {
    const k = links[Number(i)];
    return `<a href="${escapeHtml(k.u).replace(/"/g, "&quot;")}">${inlineFormat(escapeHtml(k.t))}</a>`;
  });
  l = l.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
  return l;
}

/** Markdown -> HTML Telegram (<b>, <i>, <s>, <code>, <pre>, <a>). Blok ``` yang tidak ditutup ditutup otomatis. */
export function toTelegramHtml(md: string): string {
  const out: string[] = [];
  let code: string[] | null = null;
  let lang = "";
  const flush = () => {
    const body = escapeHtml(code!.join("\n"));
    out.push(lang ? `<pre><code class="language-${lang}">${body}</code></pre>` : `<pre>${body}</pre>`);
    code = null;
  };
  for (const raw of String(md || "").replace(/\r/g, "").split("\n")) {
    const fence = raw.match(/^\s*```\s*([\w+#.-]*)\s*$/);
    if (fence) {
      if (code) flush();
      else {
        code = [];
        lang = fence[1];
      }
      continue;
    }
    if (code) code.push(raw);
    else out.push(convertLine(raw));
  }
  if (code) flush();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const TG_HELP = [
  "**My Workspace via Telegram**",
  "Tulis saja kebutuhan Anda, contoh:",
  "- Apa task saya hari ini?",
  "- Catat: hari ini selesai fitur export PDF RapiUang",
  "- Suruh Claude tambah filter kategori di RapiUang (lalu tekan ▶️ Jalankan)",
  "- Buatkan TOR rapat koordinasi isolator (dikirim sebagai file Word)",
  "- Kirim dokumen HANDOFF RapiUang",
  "- Kirim file PDF/Word/Excel untuk dibaca & disimpan faktanya",
  "",
  "Perintah:",
  "- /baru : mulai percakapan baru",
  "- /bantuan : tampilkan pesan ini",
  "",
  "Jangan kirim password lewat Telegram; simpan lewat halaman Vault di web.",
].join("\n");

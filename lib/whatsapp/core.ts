/**
 * Helper murni WhatsApp Cloud API (tanpa I/O). Diuji di tests/whatsapp.test.ts.
 *  - verifikasi tanda tangan webhook (X-Hub-Signature-256)
 *  - normalisasi nomor (08xx / +62 / 62 -> 62xxx)
 *  - ambil pesan masuk dari payload webhook
 *  - ubah Markdown jawaban AI ke format WhatsApp, potong per 3.500 karakter
 */

import crypto from "crypto";

/** Bandingkan HMAC-SHA256(rawBody, appSecret) dengan header "sha256=<hex>" secara aman. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const got = header.slice(7).trim().toLowerCase();
  if (got.length !== expected.length || !/^[0-9a-f]+$/.test(got)) return false;
  return crypto.timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

/** "0812-3456-7890", "+62 812...", "812..." -> "6281234567890". Hanya digit. */
export function normalizePhone(raw: string | undefined | null): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return d;
}

export interface InboundMessage {
  id: string;
  from: string; // wa_id, digit
  timestamp: number; // detik
  type: string;
  text: string | null; // isi teks (text / tombol interaktif)
  name: string | null;
}

/** Ambil semua pesan masuk dari payload webhook (status terkirim/dibaca diabaikan). */
export function extractMessages(payload: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      if (!value || !Array.isArray(value.messages)) continue;
      const names: Record<string, string> = {};
      for (const c of value.contacts || []) if (c?.wa_id) names[c.wa_id] = c?.profile?.name || "";
      for (const m of value.messages) {
        if (!m?.id || !m?.from) continue;
        let text: string | null = null;
        if (m.type === "text") text = m.text?.body ?? null;
        else if (m.type === "button") text = m.button?.text ?? null;
        else if (m.type === "interactive")
          text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
        out.push({
          id: String(m.id),
          from: normalizePhone(m.from),
          timestamp: Number(m.timestamp) || 0,
          type: String(m.type || "unknown"),
          text: text ? String(text) : null,
          name: names[m.from] || null,
        });
      }
    }
  }
  return out;
}

/** Markdown (jawaban AI) -> format WhatsApp: *tebal*, _miring_, ~coret~, judul jadi tebal, link jadi "teks (url)". */
export function toWhatsAppText(md: string): string {
  const BOLD = "\u0001";
  const lines = String(md || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) return line; // blok kode dibiarkan
      let l = line;
      const h = l.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
      if (h) l = `${BOLD}${h[1].replace(/\*\*/g, "")}${BOLD}`;
      l = l.replace(/^(\s*)[*-]\s+/, "$1• "); // butir daftar
      l = l.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${BOLD}`).replace(/__(.+?)__/g, `${BOLD}$1${BOLD}`);
      l = l.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1_$2_"); // *miring* markdown -> _miring_
      l = l.replace(/~~(.+?)~~/g, "~$1~");
      l = l.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)");
      l = l.replace(/^\s*\|?\s*:?-{3,}.*$/, ""); // garis pemisah tabel
      return l.split(BOLD).join("*");
    });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Potong teks panjang (batas WhatsApp 4.096 karakter). Implementasi bersama di lib/chatbot/text.ts. */
export { splitMessage } from "@/lib/chatbot/text";

/** Perintah khusus WA. */
export function parseCommand(text: string): "new" | "help" | null {
  const t = text.trim().toLowerCase();
  if (/^\/?(baru|new|reset)$/.test(t)) return "new";
  if (/^\/?(bantuan|help|menu)$/.test(t)) return "help";
  return null;
}

export const HELP_TEXT = [
  "*My Workspace via WhatsApp*",
  "Tulis saja kebutuhan Anda, contoh:",
  "• Apa task saya hari ini?",
  "• Catat: hari ini selesai fitur export PDF RapiUang",
  "• Suruh Claude tambah filter kategori di RapiUang",
  "",
  "Perintah:",
  "• *baru* : mulai percakapan baru",
  "• *bantuan* : tampilkan pesan ini",
  "",
  "Jangan kirim password lewat WhatsApp; simpan lewat halaman Vault di web.",
].join("\n");

/**
 * Memproses pesan WhatsApp masuk dari pemilik: AI Asisten yang sama dengan halaman /ai
 * (tool, data project, Activity, Claude Code), berjalan dengan sesi & RLS milik pemilik.
 * Riwayat masuk ke percakapan "📱 WhatsApp · <tanggal>" (bisa dilanjutkan dari web).
 * Logika bersama (dedupe, percakapan, AI) ada di lib/chatbot/runner.ts.
 */

import { firstTime, runOwnerTurn, type ChannelSpec } from "@/lib/chatbot/runner";
import { HELP_TEXT, normalizePhone, parseCommand, splitMessage, toWhatsAppText, type InboundMessage } from "./core";
import { markReadTyping, sendText } from "./api";

function log(...a: unknown[]) {
  console.log("[whatsapp]", ...a);
}

export const WHATSAPP_CHANNEL: ChannelSpec = {
  channel: "whatsapp",
  prefix: "📱 WhatsApp",
  tag: "whatsapp",
  format: toWhatsAppText,
  claudeNote: (names) =>
    `🛠 Instruksi Claude Code untuk *${names}* sudah disiapkan. ` +
    "Untuk menjalankan: buka My Workspace di laptop > AI > percakapan WhatsApp ini, lalu tekan *Jalankan di Claude Code*.",
  secretNote: "⚠️ Pesan WhatsApp melewati server Meta. Lain kali simpan password lewat halaman Vault di web.",
};

async function reply(to: string, text: string) {
  for (const part of splitMessage(text)) {
    const r = await sendText(to, part);
    if (!r.ok) {
      log("gagal kirim balasan:", r.status, r.error);
      break;
    }
  }
}

export async function handleInbound(msg: InboundMessage): Promise<void> {
  const owner = normalizePhone(process.env.WHATSAPP_OWNER_PHONE);
  if (!owner || msg.from !== owner) {
    log(`pesan dari nomor tidak dikenal (${msg.from.slice(0, 5)}***) diabaikan`);
    return;
  }
  if (!(await firstTime(msg.id))) return;
  // pesan lama (mis. dikirim ulang setelah server mati lama) tidak diproses
  if (msg.timestamp && Date.now() / 1000 - msg.timestamp > 15 * 60) {
    log("pesan lebih dari 15 menit diabaikan:", msg.id);
    return;
  }
  void markReadTyping(msg.id);

  if (!msg.text) {
    await reply(owner, "Saat ini lewat WhatsApp baru bisa pesan teks. Untuk file/foto, kirim lewat halaman AI di My Workspace (tombol 📎).");
    return;
  }
  const cmd = parseCommand(msg.text);
  if (cmd === "help") return reply(owner, HELP_TEXT);

  try {
    await reply(owner, (await runOwnerTurn(WHATSAPP_CHANNEL, msg.text, cmd === "new")).text);
  } catch (e) {
    log("error:", (e as Error).message);
    await reply(owner, `Maaf, terjadi kesalahan di My Workspace: ${(e as Error).message}`.slice(0, 500));
  }
}

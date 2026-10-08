import { NextRequest, NextResponse } from "next/server";
import { extractCallback, extractUpdate, verifySecret } from "@/lib/telegram/core";
import { handleTelegram, handleTelegramCallback } from "@/lib/telegram/handler";
import { runAfterResponse } from "@/lib/chatbot/background";

/**
 * Webhook Telegram Bot API.
 *  GET  : cek konfigurasi (hanya ya/tidak, tanpa nilai rahasia).
 *  POST : update masuk. Header X-Telegram-Bot-Api-Secret-Token WAJIB sama dengan TELEGRAM_WEBHOOK_SECRET.
 *         Balasan 200 dikirim segera, AI diproses di belakang.
 * Middleware login dilewati untuk path ini (lihat lib/supabase/middleware.ts).
 * Daftarkan webhook: node scripts/telegram-webhook.mjs
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const env = process.env;
  return NextResponse.json({
    ok: true,
    configured: {
      botToken: !!env.TELEGRAM_BOT_TOKEN,
      webhookSecret: !!env.TELEGRAM_WEBHOOK_SECRET,
      ownerId: !!env.TELEGRAM_OWNER_ID,
      ownerEmail: !!(env.MW_OWNER_EMAIL || env.WHATSAPP_OWNER_EMAIL || env.TELEGRAM_OWNER_EMAIL),
    },
  });
}

export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET belum diisi" }, { status: 503 });
  if (!verifySecret(req.headers.get("x-telegram-bot-api-secret-token"), expected)) {
    console.warn("[telegram] secret token tidak valid, ditolak");
    return NextResponse.json({ error: "Tidak sah" }, { status: 401 });
  }
  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // abaikan, jangan sampai Telegram mengirim ulang terus
  }
  const msg = extractUpdate(update);
  if (msg) runAfterResponse(handleTelegram(msg), "telegram");
  const cb = extractCallback(update);
  if (cb) runAfterResponse(handleTelegramCallback(cb), "telegram");
  return NextResponse.json({ ok: true });
}

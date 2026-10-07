import { NextRequest, NextResponse } from "next/server";
import { extractMessages, verifySignature } from "@/lib/whatsapp/core";
import { handleInbound } from "@/lib/whatsapp/handler";

/**
 * Webhook WhatsApp Cloud API (Meta).
 *  GET  : verifikasi saat mendaftarkan webhook (hub.verify_token = WHATSAPP_VERIFY_TOKEN).
 *  POST : pesan masuk. Tanda tangan X-Hub-Signature-256 WAJIB valid (WHATSAPP_APP_SECRET).
 *         Hanya nomor WHATSAPP_OWNER_PHONE yang dilayani. Balasan 200 dikirim segera, AI diproses di belakang.
 * Middleware login dilewati untuk path ini (lihat middleware.ts), keamanan dari tanda tangan Meta.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (p.get("hub.mode") === "subscribe" && expected && p.get("hub.verify_token") === expected) {
    return new NextResponse(p.get("hub.challenge") || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verifikasi gagal" }, { status: 403 });
}

/** Jalankan pekerjaan setelah respons dikirim. Di Vercel memakai waitUntil; di server Node biasa promise tetap jalan. */
function runAfterResponse(p: Promise<unknown>) {
  const ctx = (globalThis as any)[Symbol.for("@vercel/request-context")]?.get?.();
  if (ctx?.waitUntil) ctx.waitUntil(p);
  else p.catch((e) => console.error("[whatsapp]", e));
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) {
    console.warn("[whatsapp] tanda tangan tidak valid, ditolak");
    return NextResponse.json({ error: "Tanda tangan tidak valid" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
  }
  const messages = extractMessages(payload);
  if (messages.length) runAfterResponse((async () => {
    for (const m of messages) await handleInbound(m); // berurutan agar riwayat rapi
  })());
  return NextResponse.json({ ok: true });
}

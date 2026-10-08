import { NextRequest, NextResponse } from "next/server";
import { authAgent, finishJob, releaseJob } from "@/lib/claudeQueue/agentApi";
import { notifyFinished } from "@/lib/claudeQueue/notify";

/**
 * Laporan agent laptop untuk satu job.
 * POST { action: "release" }                                   -> kembalikan ke antrian (project sedang sibuk)
 * POST { action: "result", status, summary, files, error, costUsd } -> simpan hasil + kabari Telegram
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let auth: { userId: string } | null;
  try {
    auth = await authAgent(req.headers.get("authorization"));
  } catch (e) {
    console.error("[claude-queue]", (e as Error).message);
    return NextResponse.json({ error: "Database My Workspace belum bisa dihubungi, dicoba lagi otomatis" }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "ID job tidak valid" }, { status: 400 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }
  if (body?.action === "release") {
    const ok = await releaseJob(auth.userId, params.id);
    return NextResponse.json({ ok });
  }
  if (body?.action === "result") {
    const job = await finishJob(auth.userId, params.id, body);
    if (!job) return NextResponse.json({ error: "Job tidak ditemukan atau tidak sedang berjalan" }, { status: 404 });
    await notifyFinished(job).catch(() => {});
    return NextResponse.json({ ok: true, status: job.status });
  }
  return NextResponse.json({ error: "action harus release atau result" }, { status: 400 });
}

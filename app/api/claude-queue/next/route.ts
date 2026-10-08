import { NextRequest, NextResponse } from "next/server";
import { authAgent, claimNext, heartbeat, sweep } from "@/lib/claudeQueue/agentApi";
import { notifyFinished, notifyStarted } from "@/lib/claudeQueue/notify";

/**
 * Dipanggil agent laptop secara berkala (agent/queue.cjs).
 * Auth: Authorization: Bearer <token integrasi> (sama dengan token Activity).
 * GET ?v=<versi agent> -> { job: { id, project, instruction, mode, model } | null }
 */
export const dynamic = "force-dynamic";
// Route yang hanya punya GET: Next.js meng-cache fetch di dalamnya. Antrian & cek token WAJIB selalu segar.
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  let auth: { userId: string } | null;
  try {
    auth = await authAgent(req.headers.get("authorization"));
  } catch (e) {
    console.error("[claude-queue]", (e as Error).message);
    return NextResponse.json({ error: "Database My Workspace belum bisa dihubungi, dicoba lagi otomatis" }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });
  try {
    await heartbeat(auth.userId, req.nextUrl.searchParams.get("v"));
    for (const j of await sweep(auth.userId)) await notifyFinished(j).catch(() => {});
    const { job, pending, reason } = await claimNext(auth.userId);
    if (!job) return NextResponse.json({ job: null, ...(reason ? { pending, reason } : {}) });
    await notifyStarted(job).catch(() => {});
    return NextResponse.json({
      job: { id: job.id, project: job.project, instruction: job.instruction, mode: job.mode, model: job.model, resume: job.resume_session_id || null },
    });
  } catch (e) {
    const msg = (e as Error).message || "";
    console.error("[claude-queue] next error:", msg);
    const missing = /claude_jobs|claude_agent_status|schema cache|does not exist/i.test(msg);
    return NextResponse.json(
      { error: missing ? "Tabel antrian belum ada: jalankan migration 20261008000001_claude_jobs.sql" : msg },
      { status: missing ? 503 : 500 }
    );
  }
}

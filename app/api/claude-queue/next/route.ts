import { NextRequest, NextResponse } from "next/server";
import { authAgent, claimNext, heartbeat, sweep } from "@/lib/claudeQueue/agentApi";
import { notifyFinished, updateCard } from "@/lib/claudeQueue/notify";

/**
 * Dipanggil agent laptop secara berkala (agent/queue.cjs).
 * Auth: Authorization: Bearer <token integrasi> (sama dengan token Activity).
 * GET ?v=<versi agent> -> { job: { id, project, instruction, mode, model } | null }
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authAgent(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });
  try {
    await heartbeat(auth.userId, req.nextUrl.searchParams.get("v"));
    for (const j of await sweep(auth.userId)) await notifyFinished(j).catch(() => {});
    const job = await claimNext(auth.userId);
    if (!job) return NextResponse.json({ job: null });
    await updateCard(job).catch(() => {});
    return NextResponse.json({ job: { id: job.id, project: job.project, instruction: job.instruction, mode: job.mode, model: job.model } });
  } catch (e) {
    const msg = (e as Error).message || "";
    const missing = /claude_jobs|claude_agent_status|schema cache|does not exist/i.test(msg);
    return NextResponse.json(
      { error: missing ? "Tabel antrian belum ada: jalankan migration 20261008000001_claude_jobs.sql" : msg },
      { status: missing ? 503 : 500 }
    );
  }
}

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
    await logFileOp(auth.userId, job as any, body).catch(() => {});
    await notifyFinished(job).catch(() => {});
    return NextResponse.json({ ok: true, status: job.status });
  }
  return NextResponse.json({ error: "action harus release atau result" }, { status: 400 });
}

/** Cek status + hasil job (dipakai Muse untuk polling). Auth: Bearer token integrasi. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  let auth: { userId: string } | null;
  try {
    auth = await authAgent(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Database My Workspace belum bisa dihubungi" }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "ID job tidak valid" }, { status: 400 });
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data, error } = await createAdminClient()
    .from("claude_jobs")
    .select("id, project, mode, status, result_summary, result_files, error, queued_at, finished_at")
    .eq("id", params.id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Job tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ job: data });
}

/** Catat operasi file ke file_ops_log (best effort). */
async function logFileOp(userId: string, job: { id: string; mode: string }, body: any) {
  if (job.mode !== "file") return;
  const op = body?.fileOp;
  if (!op || !["read", "write", "list"].includes(op.op) || typeof op.path !== "string") return;
  const { createAdminClient } = await import("@/lib/supabase/server");
  await createAdminClient().from("file_ops_log").insert({
    user_id: userId,
    job_id: job.id,
    op: op.op,
    path: String(op.path).slice(0, 500),
    bytes: typeof op.bytes === "number" ? op.bytes : null,
    status: body?.status === "done" ? "done" : "error",
    error: typeof body?.error === "string" ? body.error.slice(0, 2000) : null,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authAgent } from "@/lib/claudeQueue/agentApi";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Perantara file biner agent laptop <-> Muse.
 * POST ?filename=nama.ext  (body: biner mentah, maks 50 MB) -> { key, size }
 * Auth: Authorization: Bearer <token integrasi>. Bucket private 'agent-blobs'.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const MAX_BYTES = 50 * 1024 * 1024;
const BUCKET = "agent-blobs";

function cleanName(name: string): string {
  const base = String(name || "file").split(/[\\/]/).pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function POST(req: NextRequest) {
  let auth: { userId: string } | null;
  try {
    auth = await authAgent(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Database My Workspace belum bisa dihubungi" }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });

  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return NextResponse.json({ error: "Body kosong" }, { status: 400 });
  if (buf.length > MAX_BYTES)
    return NextResponse.json({ error: `File terlalu besar (maks ${MAX_BYTES / 1048576} MB)` }, { status: 413 });

  const key = `${auth.userId}/${randomUUID()}/${cleanName(req.nextUrl.searchParams.get("filename") || "")}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(key, buf, { contentType: req.headers.get("content-type") || "application/octet-stream", upsert: false });
  if (error) {
    const missing = /bucket|not found/i.test(error.message || "");
    return NextResponse.json(
      { error: missing ? "Bucket agent-blobs belum ada: jalankan migration 20261009000001_file_ops.sql" : error.message },
      { status: missing ? 503 : 500 }
    );
  }
  return NextResponse.json({ key, size: buf.length });
}

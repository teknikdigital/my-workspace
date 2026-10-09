import { NextRequest, NextResponse } from "next/server";
import { authAgent } from "@/lib/claudeQueue/agentApi";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Unduh blob perantara (dipakai Muse). GET /api/agent-blobs/<key...>
 * Auth: Authorization: Bearer <token integrasi>. Key harus diawali user_id pemilik token.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const BUCKET = "agent-blobs";

export async function GET(req: NextRequest, { params }: { params: { key: string[] } }) {
  let auth: { userId: string } | null;
  try {
    auth = await authAgent(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Database My Workspace belum bisa dihubungi" }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });

  const key = (params.key || []).join("/");
  if (!key || !key.startsWith(auth.userId + "/") || key.includes(".."))
    return NextResponse.json({ error: "Key tidak valid" }, { status: 400 });

  const { data, error } = await createAdminClient().storage.from(BUCKET).download(key);
  if (error || !data) return NextResponse.json({ error: "Blob tidak ditemukan" }, { status: 404 });
  const buf = Buffer.from(await data.arrayBuffer());
  const filename = key.split("/").pop() || "file";
  return new NextResponse(buf, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Content-Length": String(buf.length),
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { authAgent } from "@/lib/claudeQueue/agentApi";
import { AGENT_ONLINE_MS } from "@/lib/claudeQueue/format";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Buat job antrian langsung (tanpa kartu Telegram) — dipakai Muse via token integrasi.
 * POST { project, mode, instruction, source? } -> { job: { id, status }, agentOnline, agentLastSeen }
 * Auth: Authorization: Bearer <token integrasi>.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const FILE_OPS = ["read", "write", "list"] as const;

function validateFileInstruction(instruction: string): string | null {
  let p: any;
  try {
    p = JSON.parse(instruction);
  } catch {
    return "instruction harus JSON untuk mode=file";
  }
  if (!p || typeof p !== "object") return "instruction harus objek JSON";
  if (!(FILE_OPS as readonly string[]).includes(p.op)) return `op harus salah satu: ${FILE_OPS.join(", ")}`;
  if (typeof p.path !== "string" || !p.path.trim() || p.path.length > 500)
    return "path wajib string relatif (maks 500 karakter)";
  if (/^[a-zA-Z]:[\\/]|^\\\\/.test(p.path.trim())) return "path harus relatif, bukan absolut";
  if (p.op === "write" && typeof p.content !== "string" && typeof p.contentBase64 !== "string")
    return "write butuh content atau contentBase64";
  return null;
}

export async function POST(req: NextRequest) {
  let auth: { userId: string } | null;
  try {
    auth = await authAgent(req.headers.get("authorization"));
  } catch (e) {
    return NextResponse.json({ error: "Database My Workspace belum bisa dihubungi" }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const project = String(body?.project || "").trim().slice(0, 120);
  const mode = String(body?.mode || "");
  const instruction = String(body?.instruction || "");
  const source = "muse";
  if (!project) return NextResponse.json({ error: "project wajib diisi" }, { status: 400 });
  if (!["read", "edit", "file"].includes(mode))
    return NextResponse.json({ error: "mode harus read, edit, atau file" }, { status: 400 });
  if (!instruction || instruction.length > 200_000)
    return NextResponse.json({ error: "instruction wajib diisi (maks 200 ribu karakter)" }, { status: 400 });
  if (mode === "file") {
    const err = validateFileInstruction(instruction);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("claude_jobs")
    .insert({
      user_id: auth.userId,
      project,
      instruction,
      mode,
      model: "sonnet",
      status: "queued",
      source,
      queued_at: new Date().toISOString(),
    })
    .select("id, status")
    .single();
  if (error || !data) {
    const missing = /claude_jobs|does not exist|mode_check/i.test(error?.message || "");
    return NextResponse.json(
      { error: missing ? "Tabel/antrian belum siap: jalankan migration 20261008000001 + 20261009000001" : error?.message || "Gagal membuat job" },
      { status: missing ? 503 : 500 }
    );
  }

  const { data: agent } = await db
    .from("claude_agent_status")
    .select("last_seen_at")
    .eq("user_id", auth.userId)
    .maybeSingle();
  const last = agent?.last_seen_at ? Date.parse(agent.last_seen_at) : 0;
  return NextResponse.json({
    job: data,
    agentOnline: Date.now() - last < AGENT_ONLINE_MS,
    agentLastSeen: agent?.last_seen_at || null,
  });
}

/**
 * Dokumen untuk dikirim lewat chat (Telegram):
 *  - saveGeneratedDocument: simpan dokumen buatan AI sebagai catatan "📝 judul" (bisa diminta lagi kapan saja)
 *  - findDocumentForFile: cari catatan/dokumen tersimpan berdasarkan judul untuk dikirim sebagai file
 * Berjalan dengan sesi pengguna (RLS), dipanggil dari tool AI.
 */

import { createClient } from "@/lib/supabase/server";
import { findProjectByName } from "@/lib/actions/projectAssist";

export const GENERATED_DOC_TAG = "dokumen-dibuat";
const FULL_DOC_TAG = "dokumen-lengkap";

async function projectId(project?: string): Promise<{ id: string | null; name: string | null; error?: string }> {
  if (!project?.trim()) return { id: null, name: null };
  const m = await findProjectByName(project);
  if (m.kind === "match") return { id: m.row.id, name: m.row.name };
  if (m.kind === "ambiguous") return { id: null, name: null, error: `Nama project ambigu: ${m.options.map((o) => o.name).join(", ")}` };
  return { id: null, name: null }; // project tidak ada: tetap simpan tanpa project
}

export async function saveGeneratedDocument(input: { title: string; markdown: string; project?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tidak terautentikasi" };
  const p = await projectId(input.project);
  const title = `📝 ${input.title}`.slice(0, 200);
  const row = { title, content: input.markdown, body: input.markdown, tags: [GENERATED_DOC_TAG], project_id: p.id, scope: "work" };
  const { data: existing } = await supabase.from("notes").select("id").eq("title", title).contains("tags", [GENERATED_DOC_TAG]).limit(1);
  const res = existing?.length
    ? await supabase.from("notes").update(row).eq("id", existing[0].id).select("id").single()
    : await supabase.from("notes").insert({ user_id: user.id, ...row }).select("id").single();
  if (res.error) return { success: false, error: res.error.message };
  return { success: true, note: title, project: p.name, updated: !!existing?.length };
}

const PREFIXES = ["📝", "📚", "📄"];
/** Buang ikon awalan judul catatan ("📝 TOR ..." -> "TOR ..."). */
function plainTitle(t: string): string {
  const s = String(t || "");
  const p = PREFIXES.find((x) => s.startsWith(x));
  return (p ? s.slice(p.length) : s).trim();
}

function rank(n: { title: string; tags?: string[] | null }, q: string): number {
  const t = plainTitle(n.title).toLowerCase();
  let score = 0;
  if (t === q) score += 100;
  else if (t.startsWith(q)) score += 50;
  if (n.tags?.includes(GENERATED_DOC_TAG) || n.tags?.includes(FULL_DOC_TAG)) score += 10;
  return score;
}

export async function findDocumentForFile(input: { query: string; project?: string }) {
  const q = String(input.query || "").trim().toLowerCase();
  if (q.length < 2) return { success: false as const, error: "Sebutkan judul/nama dokumen yang dicari" };
  const supabase = await createClient();
  const p = await projectId(input.project);
  if (p.error) return { success: false as const, error: p.error };
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  let sel = supabase.from("notes").select("title, content, body, tags, updated_at, project:projects(name)").ilike("title", like);
  if (p.id) sel = sel.eq("project_id", p.id);
  const { data, error } = await sel.order("updated_at", { ascending: false }).limit(10);
  if (error) return { success: false as const, error: error.message };
  const rows = ((data || []) as any[]).filter((r) => (r.content || r.body || "").trim());
  if (!rows.length) return { success: false as const, error: `Dokumen/catatan berjudul "${input.query}" tidak ditemukan` };
  rows.sort((a, b) => rank(b, q) - rank(a, q));
  const best = rows[0];
  return {
    success: true as const,
    title: plainTitle(best.title),
    content: String(best.content || best.body),
    project: best.project?.name || null,
    others: rows.slice(1, 5).map((r) => r.title),
  };
}

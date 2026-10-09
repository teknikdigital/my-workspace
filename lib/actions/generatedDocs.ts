/**
 * Dokumen untuk dikirim lewat chat (Telegram):
 *  - saveGeneratedDocument: simpan dokumen buatan AI sebagai catatan "📝 judul" (bisa diminta lagi kapan saja)
 *  - findDocumentForFile : cari dokumen tersimpan (📚 teks utuh unggahan, 📄 fakta, 📝 buatan AI) dengan
 *                          pencocokan per kata, mis. "NIB Rally District" cocok dengan "📚 nib_rally_district.pdf"
 * Berjalan dengan sesi pengguna (RLS), dipanggil dari tool AI.
 */

import { createClient } from "@/lib/supabase/server";
import { findProjectByName } from "@/lib/actions/projectAssist";
import { pickDocument, queryWords, splitOriginalPath, plainTitle, DOC_TAGS, GENERATED_DOC_TAG } from "@/lib/documents/findDocument";
import { STORAGE_PREFIX } from "@/lib/files/storageOriginal";

export { GENERATED_DOC_TAG };

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

export async function findDocumentForFile(input: { query: string; project?: string }) {
  const query = String(input.query || "").trim();
  if (query.length < 2) return { success: false as const, error: "Sebutkan judul/nama dokumen yang dicari" };
  const supabase = await createClient();
  const p = await projectId(input.project);
  if (p.error) return { success: false as const, error: p.error };

  // kandidat: semua dokumen (unggahan, fakta, buatan AI) + catatan biasa yang judulnya memuat kata pertama
  let docs = supabase.from("notes").select("title, content, body, tags, updated_at, project:projects(name)").overlaps("tags", DOC_TAGS);
  if (p.id) docs = docs.eq("project_id", p.id);
  const { data, error } = await docs.order("updated_at", { ascending: false }).limit(300);
  if (error) return { success: false as const, error: error.message };
  let rows = (data || []) as any[];
  const like = `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const { data: plain } = await supabase.from("notes").select("title, content, body, tags, updated_at, project:projects(name)").ilike("title", like).limit(10);
  rows = rows.concat(((plain || []) as any[]).filter((r) => !rows.some((x) => x.title === r.title)));

  // file di menu Documents (unggahan web / file asli dari Telegram) yang belum punya catatan teks
  if (!p.id) {
    const words = queryWords(query).slice(0, 4);
    if (words.length) {
      const or = words.map((w) => `title.ilike.%${w.replace(/[%_\\,()]/g, "")}%`).join(",");
      const { data: files } = await supabase.from("documents").select("title, file_path, updated_at").or(or).order("updated_at", { ascending: false }).limit(30);
      for (const f of (files || []) as any[]) {
        const ref = `${STORAGE_PREFIX}${f.file_path}`;
        if (rows.some((r) => String(r.content || r.body || "").includes(ref))) continue; // sudah ada catatan teksnya
        rows.push({ title: f.title, content: `\n\n---\nFile asli: ${ref}`, body: null, tags: [], updated_at: f.updated_at, project: null, _fileOnly: true });
      }
    }
  }

  const picked = pickDocument(rows, query);
  if (!picked) {
    const sample = rows.slice(0, 8).map((r) => plainTitle(r.title));
    return {
      success: false as const,
      error: `Dokumen "${query}" tidak ditemukan`,
      available_documents: sample.length ? sample : undefined,
    };
  }
  const { text, path } = splitOriginalPath(String(picked.best.content || picked.best.body || ""));
  return {
    success: true as const,
    title: plainTitle(picked.best.title),
    content: text,
    originalPath: path,
    originalOnly: !!picked.best._fileOnly,
    project: picked.best.project?.name || null,
    others: picked.others.map((r: any) => plainTitle(r.title)),
  };
}

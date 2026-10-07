"use server";

/**
 * Memori dokumen: fakta penting dari file yang dibaca AI (NIB, NPWP, nomor kontrak, tanggal, dll)
 * disimpan sebagai catatan tersemat (pinned) di project, bertag "dokumen".
 * Catatan bertag "dokumen" selalu ikut konteks AI (lib/ai/context.ts), jadi AI "ingat" tanpa membaca ulang file.
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { findProjectByName } from "@/lib/actions/projectAssist";
import { looksLikeSecret } from "@/lib/accounts/normalize";
import { formatFactsNote, type SaveDocumentFactsInput } from "@/lib/ai/fileBlocks";
import { pickSections, splitSections, tableOfContents } from "@/lib/documents/sections";

/** Tag catatan berisi teks dokumen utuh (dibaca lewat tool read_project_document). */
const FULL_DOC_TAG = "dokumen-lengkap";

export async function saveDocumentFacts(input: SaveDocumentFactsInput) {
  if (!input.file_name?.trim()) return { success: false, error: "file_name wajib" };
  if (!input.facts?.length && !input.summary) return { success: false, error: "Tidak ada fakta atau ringkasan untuk disimpan" };
  // Nilai rahasia tidak boleh masuk catatan biasa
  for (const f of input.facts || []) {
    if (/\[\[RAHASIA_\d+\]\]/.test(f.value) || looksLikeSecret(`${f.label}: ${f.value}`)) {
      return { success: false, error: `Fakta "${f.label}" terlihat rahasia. Simpan lewat create_vault_credential.` };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tidak terautentikasi" };

  let projectId: string | null = null;
  let projectName: string | null = null;
  if (input.project) {
    const m = await findProjectByName(input.project);
    if (m.kind === "match") {
      projectId = m.row.id;
      projectName = m.row.name;
    } else if (m.kind === "ambiguous") {
      return { success: false, error: "Nama project ambigu", ambiguous: m.options.map((o) => o.name) };
    }
    // tidak ditemukan: tetap disimpan tanpa project (dilaporkan)
  }

  const title = `📄 ${input.file_name.trim()}`.slice(0, 200);
  const content = formatFactsNote(input);

  // Upload ulang file yang sama -> perbarui catatan lama, bukan membuat ganda
  let q = supabase.from("notes").select("id").eq("title", title).contains("tags", ["dokumen"]).limit(1);
  q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
  const { data: existing } = await q;

  const row = {
    title,
    content,
    body: content, // pencarian fallback memakai kolom body
    tags: ["dokumen"],
    project_id: projectId,
    is_pinned: true,
    scope: "work",
  };
  const res = existing && existing.length
    ? await supabase.from("notes").update(row).eq("id", existing[0].id).select("id").single()
    : await supabase.from("notes").insert({ user_id: user.id, ...row }).select("id").single();
  if (res.error) return { success: false, error: res.error.message };

  revalidatePath("/personal/notes");
  revalidatePath("/work/projects/[id]", "page");
  return {
    success: true,
    note_id: res.data.id,
    updated: !!(existing && existing.length),
    project: projectName,
    project_not_found: input.project && !projectId ? input.project : undefined,
    saved_facts: (input.facts || []).length,
  };
}

/**
 * Simpan teks dokumen UTUH sebagai catatan project (dipanggil server, bukan AI, jadi tidak
 * memakan token output). Upload ulang file yang sama -> catatan diperbarui.
 */
export async function saveDocumentText(input: { project?: string; file_name: string; file_path?: string; text: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tidak terautentikasi" };

  let projectId: string | null = null;
  let projectName: string | null = null;
  if (input.project) {
    const m = await findProjectByName(input.project);
    if (m.kind === "match") {
      projectId = m.row.id;
      projectName = m.row.name;
    }
  }

  const title = `📚 ${input.file_name.trim()}`.slice(0, 200);
  const content = `${input.text.trim()}${input.file_path ? `\n\n---\nFile asli: ${input.file_path}` : ""}`;
  let q = supabase.from("notes").select("id").eq("title", title).contains("tags", [FULL_DOC_TAG]).limit(1);
  q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
  const { data: existing } = await q;

  const row = { title, content, body: content, tags: [FULL_DOC_TAG], project_id: projectId, scope: "work" };
  const res =
    existing && existing.length
      ? await supabase.from("notes").update(row).eq("id", existing[0].id).select("id").single()
      : await supabase.from("notes").insert({ user_id: user.id, ...row }).select("id").single();
  if (res.error) return { success: false, error: res.error.message };

  revalidatePath("/personal/notes");
  revalidatePath("/work/projects/[id]", "page");
  return {
    success: true,
    note_id: res.data.id,
    title,
    project: projectName,
    updated: !!(existing && existing.length),
    sections: splitSections(input.text).length,
  };
}

/**
 * Baca bagian dokumen project yang relevan dengan pertanyaan (maks ~6.000 karakter).
 * Tanpa pertanyaan: kembalikan daftar isi agar AI bisa memilih bagian.
 */
export async function readProjectDocument(input: { project?: string; query?: string; document?: string }) {
  const supabase = await createClient();
  let q = supabase.from("notes").select("title, content, body, project:projects(name)").contains("tags", [FULL_DOC_TAG]);
  if (input.project) {
    const m = await findProjectByName(input.project);
    if (m.kind === "match") q = q.eq("project_id", m.row.id);
    else if (m.kind === "ambiguous") return { success: false, error: "Nama project ambigu", options: m.options.map((o) => o.name) };
    else return { success: false, error: `Project "${input.project}" tidak ditemukan` };
  }
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(10);
  if (error) return { success: false, error: error.message };
  let docs = (data || []) as any[];
  if (input.document) docs = docs.filter((d) => d.title.toLowerCase().includes(input.document!.toLowerCase()));
  if (!docs.length) return { success: false, error: "Belum ada dokumen lengkap tersimpan untuk project ini" };

  const results = docs.map((d) => {
    const sections = splitSections(d.content || d.body || "");
    const picked = input.query ? pickSections(sections, input.query, 6000 / docs.length) : [];
    return {
      document: d.title,
      project: d.project?.name || null,
      sections: picked.map((s) => ({ heading: s.heading, text: s.text })),
      table_of_contents: picked.length ? undefined : tableOfContents(sections),
    };
  });
  return { success: true, results };
}

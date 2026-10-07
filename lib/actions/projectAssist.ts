"use server";

/**
 * Aksi project untuk AI Assistant:
 * - ensureProject: buat project bila belum ada (tidak membuat ganda bila nama sudah ada).
 * - findProjectByName: cari project dari nama yang diketik pengguna.
 * - checkProjectReadiness: checklist "apa yang kurang" (lihat lib/projects/readiness.ts).
 */

import { createClient } from "@/lib/supabase/server";
import { createProject, getProjectById } from "@/lib/actions/projects";
import { matchByName, type NamedRow } from "@/lib/accounts/normalize";
import { buildReadiness, type ProjectDetailLike } from "@/lib/projects/readiness";
import type { ProjectInput } from "@/lib/validators/projects";

export async function findProjectByName(name: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("id, name, slug");
  if (error) return { kind: "error" as const, error: error.message };
  return matchByName(name, (data || []) as NamedRow[]);
}

export async function ensureProject(input: {
  name: string;
  description?: string;
  status?: ProjectInput["status"];
  category?: string;
  tech_stack?: string[];
  progress?: number;
}) {
  if (!input.name?.trim()) return { success: false, error: "Nama project wajib diisi" };

  const found = await findProjectByName(input.name);
  if (found.kind === "match" && found.row.name.toLowerCase() === input.name.trim().toLowerCase()) {
    return { success: true, created: false, project: found.row, note: "Project dengan nama ini sudah ada, tidak dibuat ganda." };
  }

  const res = await createProject({
    name: input.name.trim(),
    description: input.description || null,
    status: input.status || "development",
    progress: input.progress ?? 0,
    category: input.category || null,
    tech_stack: input.tech_stack || [],
  });
  if ("error" in res && res.error) return { success: false, error: res.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && res.data) {
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      project_id: res.data.id,
      summary: `Project ${res.data.name} dibuat lewat AI Assistant`,
      activity_type: "planning",
      source: "ai",
    });
  }
  return {
    success: true,
    created: true,
    project: { id: res.data!.id, name: res.data!.name, slug: res.data!.slug },
  };
}

export async function checkProjectReadiness(projectNameOrId: string) {
  let id = projectNameOrId;
  if (!/^[0-9a-f-]{36}$/i.test(projectNameOrId)) {
    const m = await findProjectByName(projectNameOrId);
    if (m.kind === "error") return { success: false, error: m.error };
    if (m.kind === "none") return { success: false, error: `Project "${projectNameOrId}" tidak ditemukan` };
    if (m.kind === "ambiguous")
      return { success: false, ambiguous: m.options.map((o) => o.name), error: "Nama project ambigu, pilih salah satu" };
    id = m.row.id;
  }
  const project = await getProjectById(id);
  if (!project) return { success: false, error: "Project tidak ditemukan" };
  return { success: true, project_id: id, report: buildReadiness(project as ProjectDetailLike) };
}

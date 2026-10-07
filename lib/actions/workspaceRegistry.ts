"use server";

/**
 * Aksi AI untuk melengkapi project: resource (repo/database/deployment/dokumen), aplikasi, dan detail project.
 * Semua dicari/dibuat tanpa duplikat, lalu disambungkan ke project berdasarkan nama.
 * Skema: supabase/full_schema.sql (resources.name NOT NULL, applications.slug NOT NULL).
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { findProjectByName } from "@/lib/actions/projectAssist";
import { matchByName, slugify, type NamedRow } from "@/lib/accounts/normalize";
import {
  deriveResourceName,
  guessAppType,
  guessCategory,
  normalizeUrl,
  roleFromCategory,
  ROLES,
  type ResourceRole,
} from "@/lib/resources/classify";

type Supa = Awaited<ReturnType<typeof createClient>>;

async function resolveProject(name?: string) {
  if (!name) return { id: null as string | null, name: null as string | null };
  const m = await findProjectByName(name);
  if (m.kind === "match") return { id: m.row.id, name: m.row.name };
  if (m.kind === "ambiguous") return { error: `Nama project "${name}" ambigu: ${m.options.map((o) => o.name).join(", ")}` };
  if (m.kind === "error") return { error: m.error };
  return { error: `Project "${name}" tidak ditemukan. Buat dulu dengan create_project.` };
}

async function findAccountId(supabase: Supa, identifier?: string) {
  if (!identifier) return null;
  const { data } = await supabase
    .from("accounts")
    .select("id")
    // nilai diberi tanda kutip agar karakter seperti titik/koma tidak merusak filter
    .or(`email.eq."${identifier}",identifier.eq."${identifier}",username.eq."${identifier}"`)
    .limit(1);
  return data?.[0]?.id || null;
}

function refreshMenus() {
  for (const p of ["/", "/work/projects", "/work/resources", "/work/applications", "/work/activity", "/ai"]) revalidatePath(p);
  revalidatePath("/work/projects/[id]", "page");
}

/* ------------------------------------------------------------------ */

export interface RegisterResourceInput {
  project?: string;
  application?: string;
  url?: string;
  name?: string;
  role?: string; // repository | database | deployment | documentation | other
  category?: string; // github | supabase | vercel | ...
  account?: string; // email/username akun yang menaungi resource
  notes?: string;
}

export async function registerResource(input: RegisterResourceInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tidak terautentikasi" };

  const url = normalizeUrl(input.url);
  if (input.url && !url) return { success: false, error: `URL tidak valid: ${input.url}` };
  if (!url && !input.name) return { success: false, error: "Isi url atau name resource" };

  const project = await resolveProject(input.project);
  if ("error" in project) return { success: false, error: project.error };

  const category = guessCategory(url, input.category || input.role);
  const role: ResourceRole = ROLES.includes(input.role as ResourceRole)
    ? (input.role as ResourceRole)
    : roleFromCategory(category);
  const name = deriveResourceName(url, category, input.name);
  const accountId = await findAccountId(supabase, input.account);

  // Cari resource yang sama (URL sama, atau nama + kategori sama) agar tidak ganda
  const existingQ = url
    ? supabase.from("resources").select("id").eq("url", url).limit(1)
    : supabase.from("resources").select("id").eq("name", name).eq("category", category).limit(1);
  const { data: existing } = await existingQ;

  let resourceId: string;
  let created = false;
  if (existing && existing.length) {
    resourceId = existing[0].id;
    const patch: Record<string, unknown> = {};
    if (accountId) patch.account_id = accountId;
    if (input.notes) patch.notes = input.notes;
    if (Object.keys(patch).length) await supabase.from("resources").update(patch).eq("id", resourceId);
  } else {
    const { data, error } = await supabase
      .from("resources")
      .insert({
        user_id: user.id,
        name,
        title: name,
        url,
        category,
        account_id: accountId,
        notes: input.notes || null,
      })
      .select("id")
      .single();
    if (error) return { success: false, error: `Gagal menyimpan resource: ${error.message}` };
    resourceId = data.id;
    created = true;
  }

  const linked: string[] = [];
  if (project.id) {
    const { error } = await supabase
      .from("project_resources")
      .upsert({ project_id: project.id, resource_id: resourceId, role }, { onConflict: "project_id,resource_id" });
    if (error) return { success: false, error: `Gagal menghubungkan ke project: ${error.message}` };
    linked.push(`project ${project.name} (${role})`);
  }
  if (input.application) {
    const { data: apps } = await supabase.from("applications").select("id, name, slug");
    const m = matchByName(input.application, (apps || []) as NamedRow[]);
    if (m.kind === "match") {
      await supabase
        .from("application_resources")
        .upsert({ application_id: m.row.id, resource_id: resourceId, role }, { onConflict: "application_id,resource_id" });
      linked.push(`aplikasi ${m.row.name}`);
    }
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    project_id: project.id,
    summary: `Resource ${name} (${role}) ${created ? "ditambahkan" : "dihubungkan"}${linked.length ? ` ke ${linked.join(", ")}` : ""}`,
    activity_type: "configuration",
    source: "ai",
  });
  refreshMenus();
  return { success: true, created, resource: { id: resourceId, name, url, category, role }, linked, account_linked: !!accountId };
}

/* ------------------------------------------------------------------ */

export interface RegisterApplicationInput {
  name: string;
  project?: string;
  type?: string;
  framework?: string;
  production_url?: string;
  staging_url?: string;
  status?: string;
  description?: string;
}

const STATUSES = ["planning", "development", "testing", "production", "maintenance", "archived"];

export async function registerApplication(input: RegisterApplicationInput) {
  if (!input.name?.trim()) return { success: false, error: "Nama aplikasi wajib" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tidak terautentikasi" };

  const project = await resolveProject(input.project);
  if ("error" in project) return { success: false, error: project.error };

  const prod = normalizeUrl(input.production_url);
  const staging = normalizeUrl(input.staging_url);
  const appType = guessAppType(input.framework, input.type);
  const row: Record<string, unknown> = {
    name: input.name.trim(),
    slug: slugify(input.name) || "app",
    app_type: appType,
    type: appType,
    framework: input.framework || null,
    project_id: project.id,
  };
  if (prod) row.production_url = prod;
  if (staging) row.staging_url = staging;
  if (input.description) row.description = input.description;
  if (input.status && STATUSES.includes(input.status)) row.status = input.status;

  // Aplikasi dengan nama sama (di project yang sama) diperbarui, bukan dibuat ganda
  let q = supabase.from("applications").select("id").ilike("name", input.name.trim()).limit(1);
  q = project.id ? q.eq("project_id", project.id) : q;
  const { data: existing } = await q;

  const res =
    existing && existing.length
      ? await supabase.from("applications").update(row).eq("id", existing[0].id).select("id, name").single()
      : await supabase
          .from("applications")
          .insert({ user_id: user.id, status: "development", ...row })
          .select("id, name")
          .single();
  if (res.error) return { success: false, error: `Gagal menyimpan aplikasi: ${res.error.message}` };

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    project_id: project.id,
    application_id: res.data.id,
    summary: `Aplikasi ${res.data.name} ${existing && existing.length ? "diperbarui" : "didaftarkan"}${project.name ? ` di project ${project.name}` : ""}`,
    activity_type: "configuration",
    source: "ai",
  });
  refreshMenus();
  return { success: true, created: !(existing && existing.length), application: { ...res.data, type: appType, production_url: prod } };
}

/* ------------------------------------------------------------------ */

export interface UpdateProjectInput {
  project: string;
  description?: string;
  status?: string;
  progress?: number;
  category?: string;
  tech_stack?: string[];
  local_folder?: string;
}

export async function updateProjectDetails(input: UpdateProjectInput) {
  const project = await resolveProject(input.project);
  if ("error" in project) return { success: false, error: project.error };
  if (!project.id) return { success: false, error: "Nama project wajib" };

  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  let description = input.description?.trim();
  // Folder lokal dicatat di deskripsi (belum ada kolom khusus)
  if (input.local_folder) {
    const { data } = await supabase.from("projects").select("description").eq("id", project.id).single();
    const base = (description ?? data?.description ?? "").replace(/\n?Folder lokal: .*$/m, "").trim();
    description = `${base}${base ? "\n" : ""}Folder lokal: ${input.local_folder.trim()}`;
  }
  if (description !== undefined) patch.description = description;
  if (input.status && STATUSES.includes(input.status)) patch.status = input.status;
  if (typeof input.progress === "number") patch.progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  if (input.category) patch.category = input.category;
  if (input.tech_stack?.length) patch.tech_stack = input.tech_stack;
  if (!Object.keys(patch).length) return { success: false, error: "Tidak ada yang diubah" };

  const { error } = await supabase.from("projects").update(patch).eq("id", project.id);
  if (error) return { success: false, error: error.message };
  refreshMenus();
  return { success: true, project: project.name, updated: Object.keys(patch) };
}

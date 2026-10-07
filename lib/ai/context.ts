import { createClient } from "@/lib/supabase/server";

/**
 * Konteks workspace yang dikirim ke AI di setiap pesan.
 * Dibuat RAMPING agar biaya token stabil walau data bertambah:
 * - jumlah baris per bagian dibatasi (lihat LIMITS);
 * - UUID hanya untuk project (tool lain menerima nama);
 * - detail lain diambil AI sendiri lewat tool search_workspace / get_project_details bila perlu;
 * - catatan bertag "dokumen" (fakta NIB, NPWP, dll) SELALU disertakan agar AI "ingat".
 */
const LIMITS = {
  projects: 40,
  apps: 30,
  resources: 30,
  accounts: 40,
  tasks: 30,
  notes: 15,
  docFacts: 40,
  activities: 8,
  factChars: 400,
};

const cut = (s: string | null | undefined, n: number) => {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

export async function buildUserWorkspaceSummary(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "User tidak terautentikasi.";

  const [projectsRes, appsRes, resourcesRes, accountsRes, tasksRes, notesRes, docsRes, fullDocsRes, activitiesRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, progress, tech_stack")
      .order("last_opened_at", { ascending: false })
      .limit(LIMITS.projects),
    supabase.from("applications").select("name, type, status, project:projects(name)").limit(LIMITS.apps),
    supabase.from("resources").select("title, url, category").limit(LIMITS.resources),
    supabase.from("accounts").select("label, identifier, email, service:services (name)").limit(LIMITS.accounts),
    supabase
      .from("tasks")
      .select("title, status, priority, due_date, project:projects(name)")
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(LIMITS.tasks),
    supabase
      .from("notes")
      .select("title, content, body, scope, tags")
      .or("tags.is.null,and(tags.not.cs.{dokumen},tags.not.cs.{dokumen-lengkap})")
      .order("created_at", { ascending: false })
      .limit(LIMITS.notes),
    supabase
      .from("notes")
      .select("title, content, body, project:projects(name)")
      .contains("tags", ["dokumen"])
      .order("updated_at", { ascending: false })
      .limit(LIMITS.docFacts),
    supabase
      .from("notes")
      .select("title, project:projects(name)")
      .contains("tags", ["dokumen-lengkap"])
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("activity_logs")
      .select("summary, created_at, project:projects(name)")
      .order("created_at", { ascending: false })
      .limit(LIMITS.activities),
  ]);

  const projects = projectsRes.data || [];
  const apps = appsRes.data || [];
  const resources = resourcesRes.data || [];
  const accounts = accountsRes.data || [];
  const tasks = tasksRes.data || [];
  const notes = notesRes.data || [];
  const docs = docsRes.data || [];
  const fullDocs = fullDocsRes.data || [];
  const activities = activitiesRes.data || [];

  const section = (title: string, lines: string[], limit: number) =>
    `=== ${title} (${lines.length}${lines.length >= limit ? "+, sebagian" : ""}) ===\n${lines.join("\n") || "-"}`;

  return `
KONTEKS WORKSPACE (ringkas; gunakan tool search_workspace / get_project_details untuk detail lain):

${section(
  "PROJECTS",
  projects.map(
    (p: any) => `- [${p.id}] ${p.name} | ${p.status}, ${p.progress ?? 0}% | ${(p.tech_stack || []).join(", ") || "-"}`
  ),
  LIMITS.projects
)}

${section(
  "FAKTA DOKUMEN (hasil baca file, selalu diingat)",
  docs.map((d: any) => `- [${d.project?.name || "Umum"}] ${d.title}: ${cut(d.content || d.body, LIMITS.factChars)}`),
  LIMITS.docFacts
)}

${section(
  "DOKUMEN LENGKAP TERSIMPAN (baca dengan read_project_document)",
  fullDocs.map((d: any) => `- [${d.project?.name || "Umum"}] ${d.title}`),
  20
)}

${section(
  "APPLICATIONS",
  apps.map((a: any) => `- ${a.name} (${a.type || "-"}, ${a.status || "-"}) | project: ${a.project?.name || "-"}`),
  LIMITS.apps
)}

${section(
  "RESOURCES",
  resources.map((r: any) => `- ${r.title} (${r.category || "-"}) ${r.url || ""}`),
  LIMITS.resources
)}

${section(
  "ACCOUNTS",
  accounts.map((a: any) => `- ${a.service?.name || "Lainnya"}: ${a.identifier || a.email || "-"} (${a.label || "-"})`),
  LIMITS.accounts
)}

${section(
  "TASKS AKTIF (urut tenggat)",
  tasks.map(
    (t: any) => `- ${t.title} | ${t.status}, ${t.priority}, due ${t.due_date || "-"} | ${t.project?.name || "-"}`
  ),
  LIMITS.tasks
)}

${section(
  "AKTIVITAS TERAKHIR",
  activities.map((a: any) => `- ${String(a.created_at).slice(0, 10)} [${a.project?.name || "Global"}] ${cut(a.summary, 120)}`),
  LIMITS.activities
)}

${section(
  "CATATAN TERBARU",
  notes.map((n: any) => `- [${n.scope || "-"}] ${n.title || "Catatan"}: ${cut(n.content || n.body, 80)}`),
  LIMITS.notes
)}
`.trim();
}

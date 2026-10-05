import { createClient } from "@/lib/supabase/server";

export async function buildUserWorkspaceSummary(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "User tidak terautentikasi.";

  const [projectsRes, appsRes, resourcesRes, accountsRes, tasksRes, notesRes, activitiesRes] =
    await Promise.all([
      supabase.from("projects").select("id, name, description, status, progress, category, tech_stack"),
      supabase.from("applications").select("id, name, type, framework, production_url, status, project_id"),
      supabase.from("resources").select("id, title, url, category, notes, account_id"),
      supabase.from("accounts").select("id, label, identifier, service:services (name)"),
      supabase.from("tasks").select("id, title, description, status, priority, due_date, project_id"),
      supabase.from("notes").select("id, title, body, scope"),
      supabase.from("activity_logs").select("id, summary, source, created_at, project:projects(name)").limit(10),
    ]);

  const projects = projectsRes.data || [];
  const apps = appsRes.data || [];
  const resources = resourcesRes.data || [];
  const accounts = accountsRes.data || [];
  const tasks = tasksRes.data || [];
  const notes = notesRes.data || [];
  const activities = activitiesRes.data || [];

  return `
KONTEKS WORKSPACE PENGGUNA (DATA TERKINI):

=== PROJECTS (${projects.length}) ===
${projects
  .map(
    (p) =>
      `- [${p.id}] ${p.name} (Status: ${p.status}, Progress: ${p.progress}%, Kategori: ${p.category || '-'}) | Tech: ${
        p.tech_stack?.join(', ') || '-'
      } | Ket: ${p.description || '-'}`
  )
  .join('\n')}

=== APPLICATIONS (${apps.length}) ===
${apps
  .map(
    (a) =>
      `- [${a.id}] ${a.name} (Tipe: ${a.type}, Framework: ${a.framework || '-'}, Status: ${a.status}) | URL: ${
        a.production_url || '-'
      } | ProjectID: ${a.project_id || '-'}`
  )
  .join('\n')}

=== RESOURCES (${resources.length}) ===
${resources
  .map(
    (r) =>
      `- [${r.id}] ${r.title} (${r.category}) -> ${r.url} | AkunID: ${r.account_id || '-'}`
  )
  .join('\n')}

=== ACCOUNTS (${accounts.length}) ===
${accounts
  .map(
    (acc: any) =>
      `- [${acc.id}] ${acc.label} (${acc.identifier}) | Layanan: ${acc.service?.name || '-'}`
  )
  .join('\n')}

=== TASKS AKTIF (${tasks.filter((t) => t.status !== 'done').length}) ===
${tasks
  .filter((t) => t.status !== 'done')
  .map(
    (t) =>
      `- [${t.id}] ${t.title} (Status: ${t.status}, Prioritas: ${t.priority}, Due: ${t.due_date || '-'}) | ProjectID: ${
        t.project_id || '-'
      }`
  )
  .join('\n')}

=== RECENT ACTIVITY ===
${activities
  .map(
    (act: any) =>
      `- [${act.created_at}] [${act.project?.name || 'Global'}] ${act.summary} (via ${act.source})`
  )
  .join('\n')}

=== NOTES (${notes.length}) ===
${notes
  .map((n) => `- [${n.scope}] ${n.title || 'Catatan'}: ${n.body?.slice(0, 80)}...`)
  .join('\n')}
`.trim();
}

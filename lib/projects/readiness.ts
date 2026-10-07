/**
 * Checklist kesiapan project (murni, tanpa database) agar AI bisa menjawab
 * "apa yang kurang di project ini?" secara konsisten. Diuji di tests/projectReadiness.test.ts.
 */

export interface ReadinessItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  suggestion?: string;
}

export interface ReadinessReport {
  project: string;
  status: string | null;
  progress: number | null;
  score: number; // 0-100, persentase item terpenuhi
  items: ReadinessItem[];
  missing: string[];
}

// Bentuk data mengikuti getProjectById() di lib/actions/projects.ts
export interface ProjectDetailLike {
  name: string;
  description?: string | null;
  status?: string | null;
  progress?: number | null;
  tech_stack?: string[] | null;
  applications?: { name: string }[] | null;
  project_accounts?: { accounts?: { email?: string | null; label?: string | null; services?: { name?: string } | null } | null }[] | null;
  project_resources?: { role?: string | null; resources?: { name?: string | null; title?: string | null } | null }[] | null;
  tasks?: { title: string; status?: string | null; due_date?: string | null }[] | null;
  notes?: unknown[] | null;
}

export function buildReadiness(p: ProjectDetailLike, today = new Date().toISOString().slice(0, 10)): ReadinessReport {
  const resources = p.project_resources || [];
  const byRole = (role: string) => resources.filter((r) => r.role === role);
  const resName = (r: (typeof resources)[number]) => r.resources?.name || r.resources?.title || "(tanpa nama)";
  const accounts = p.project_accounts || [];
  const tasks = p.tasks || [];
  const openTasks = tasks.filter((t) => t.status !== "done");
  const overdue = openTasks.filter((t) => t.due_date && t.due_date < today);

  const items: ReadinessItem[] = [
    {
      key: "description",
      label: "Deskripsi & tujuan project",
      ok: !!p.description && p.description.trim().length >= 20,
      detail: p.description ? `${p.description.slice(0, 80)}${p.description.length > 80 ? "..." : ""}` : "Belum ada",
      suggestion: "Tulis deskripsi singkat: tujuan, pengguna, dan fitur inti.",
    },
    {
      key: "tech_stack",
      label: "Tech stack",
      ok: (p.tech_stack || []).length > 0,
      detail: (p.tech_stack || []).join(", ") || "Belum diisi",
      suggestion: "Isi tech stack, mis. Next.js, Supabase, Tailwind.",
    },
    {
      key: "repository",
      label: "Repository kode",
      ok: byRole("repository").length > 0,
      detail: byRole("repository").map(resName).join(", ") || "Belum terhubung",
      suggestion: "Hubungkan resource repository (GitHub/GitLab).",
    },
    {
      key: "database",
      label: "Database",
      ok: byRole("database").length > 0,
      detail: byRole("database").map(resName).join(", ") || "Belum terhubung",
      suggestion: "Hubungkan resource database (mis. project Supabase).",
    },
    {
      key: "deployment",
      label: "Deployment / hosting",
      ok: byRole("deployment").length > 0,
      detail: byRole("deployment").map(resName).join(", ") || "Belum terhubung",
      suggestion: "Hubungkan resource deployment (Vercel/Netlify/cPanel).",
    },
    {
      key: "accounts",
      label: "Akun layanan terhubung",
      ok: accounts.length > 0,
      detail:
        accounts
          .map((a) => `${a.accounts?.services?.name || "?"}: ${a.accounts?.email || a.accounts?.label || "?"}`)
          .join(", ") || "Belum ada",
      suggestion: "Daftarkan akun yang dipakai (Supabase, Vercel, GitHub) lewat register_account.",
    },
    {
      key: "applications",
      label: "Aplikasi terdaftar",
      ok: (p.applications || []).length > 0,
      detail: (p.applications || []).map((a) => a.name).join(", ") || "Belum ada",
      suggestion: "Daftarkan aplikasinya di menu Applications.",
    },
    {
      key: "tasks",
      label: "Task berjalan",
      ok: openTasks.length > 0 && overdue.length === 0,
      detail:
        tasks.length === 0
          ? "Belum ada task"
          : `${openTasks.length} terbuka, ${overdue.length} lewat tenggat, ${tasks.length - openTasks.length} selesai`,
      suggestion:
        overdue.length > 0
          ? `Tinjau ${overdue.length} task yang lewat tenggat: ${overdue.slice(0, 3).map((t) => t.title).join("; ")}`
          : "Pecah pekerjaan development menjadi task dengan tenggat.",
    },
    {
      key: "notes",
      label: "Catatan / dokumentasi",
      ok: (p.notes || []).length > 0,
      detail: `${(p.notes || []).length} catatan`,
      suggestion: "Simpan keputusan teknis & catatan setup sebagai Note project.",
    },
  ];

  const okCount = items.filter((i) => i.ok).length;
  return {
    project: p.name,
    status: p.status ?? null,
    progress: p.progress ?? null,
    score: Math.round((okCount / items.length) * 100),
    items: items.map((i) => (i.ok ? { ...i, suggestion: undefined } : i)),
    missing: items.filter((i) => !i.ok).map((i) => i.label),
  };
}

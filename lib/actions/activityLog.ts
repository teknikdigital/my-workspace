"use server";

/**
 * Catat pekerjaan harian ke Activity (terhubung ke project) + tandai task selesai + update progress.
 * Dipakai AI tool log_activity dan get_activity_summary.
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { findProjectByName } from "@/lib/actions/projectAssist";
import { matchByName, type NamedRow } from "@/lib/accounts/normalize";
import { groupByProject, noonWibIso, periodRange, type ActivityRow, type Period } from "@/lib/activity/period";

const TYPES = ["development", "bugfix", "deployment", "review", "documentation", "testing", "meeting", "planning", "configuration", "other"];
const STATUSES = ["in_progress", "completed", "blocked", "cancelled"];

export interface LogActivityInput {
  project?: string;
  summary: string;
  details?: string;
  activity_type?: string;
  status?: string;
  files_changed?: string[];
  date?: string; // YYYY-MM-DD (WIB), default hari ini
  complete_tasks?: string[]; // judul task yang selesai
  progress?: number; // 0-100, progress project terbaru
}

export async function logActivity(input: LogActivityInput) {
  if (!input.summary?.trim()) return { success: false, error: "Ringkasan pekerjaan wajib diisi" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tidak terautentikasi" };

  let projectId: string | null = null;
  let projectName: string | null = null;
  const warnings: string[] = [];
  if (input.project) {
    const m = await findProjectByName(input.project);
    if (m.kind === "match") {
      projectId = m.row.id;
      projectName = m.row.name;
    } else if (m.kind === "ambiguous") {
      return { success: false, error: `Nama project ambigu: ${m.options.map((o) => o.name).join(", ")}` };
    } else {
      warnings.push(`Project "${input.project}" tidak ditemukan, aktivitas dicatat tanpa project.`);
    }
  }

  const createdAt = input.date ? noonWibIso(input.date) : null;
  if (input.date && !createdAt) warnings.push(`Format tanggal "${input.date}" tidak dikenali, dipakai waktu sekarang.`);

  const { data: act, error } = await supabase
    .from("activity_logs")
    .insert({
      user_id: user.id,
      project_id: projectId,
      summary: input.summary.trim().slice(0, 1000),
      details: input.details ? { catatan: input.details } : null,
      activity_type: TYPES.includes(input.activity_type || "") ? input.activity_type : "development",
      status: STATUSES.includes(input.status || "") ? input.status : "completed",
      files_changed: (input.files_changed || []).slice(0, 100),
      source: "ai",
      ...(createdAt ? { created_at: createdAt } : {}),
    })
    .select("id, created_at")
    .single();
  if (error) return { success: false, error: `Gagal mencatat aktivitas: ${error.message}` };

  // Tandai task selesai (dicocokkan dengan judul, hanya task yang belum selesai)
  const completed: string[] = [];
  const notFound: string[] = [];
  if (input.complete_tasks?.length) {
    let q = supabase.from("tasks").select("id, title, status").neq("status", "done");
    if (projectId) q = q.eq("project_id", projectId);
    const { data: tasks } = await q;
    const rows: NamedRow[] = (tasks || []).map((t: any) => ({ id: t.id, name: t.title }));
    for (const title of input.complete_tasks) {
      const m = matchByName(title, rows);
      if (m.kind === "match") {
        const { error: e } = await supabase.from("tasks").update({ status: "done" }).eq("id", m.row.id);
        if (!e) completed.push(m.row.name);
      } else if (m.kind === "ambiguous") {
        warnings.push(`Task "${title}" ambigu: ${m.options.map((o) => o.name).join(", ")}`);
      } else {
        notFound.push(title);
      }
    }
  }

  // Progress project
  let progress: number | undefined;
  if (projectId && typeof input.progress === "number") {
    progress = Math.max(0, Math.min(100, Math.round(input.progress)));
    await supabase.from("projects").update({ progress, last_opened_at: new Date().toISOString() }).eq("id", projectId);
  }

  for (const p of ["/", "/work/activity", "/work/tasks", "/work/projects"]) revalidatePath(p);
  revalidatePath("/work/projects/[id]", "page");
  return {
    success: true,
    activity_id: act.id,
    project: projectName,
    date: input.date || "hari ini",
    tasks_completed: completed,
    tasks_not_found: notFound,
    progress,
    warnings,
  };
}

export async function getActivitySummary(input: { period?: Period; project?: string }) {
  const supabase = await createClient();
  const period: Period = (["today", "yesterday", "week", "last7", "month"] as const).includes(input.period as Period)
    ? (input.period as Period)
    : "today";
  const range = periodRange(period);
  let q = supabase
    .from("activity_logs")
    .select("summary, created_at, activity_type, status, source, project:projects(name)")
    .gte("created_at", range.start)
    .lt("created_at", range.end)
    .order("created_at", { ascending: true })
    .limit(200);
  if (input.project) {
    const m = await findProjectByName(input.project);
    if (m.kind !== "match") return { success: false, error: `Project "${input.project}" tidak ditemukan atau ambigu` };
    q = q.eq("project_id", m.row.id);
  }
  const { data, error } = await q;
  if (error) return { success: false, error: error.message };

  // Task yang selesai pada periode yang sama
  const { data: done } = await supabase
    .from("tasks")
    .select("title, updated_at, project:projects(name)")
    .eq("status", "done")
    .gte("updated_at", range.start)
    .lt("updated_at", range.end)
    .limit(100);

  return {
    success: true,
    period: range.label,
    total: (data || []).length,
    by_project: groupByProject((data || []) as unknown as ActivityRow[]),
    tasks_done: (done || []).map((t: any) => ({ title: t.title, project: t.project?.name || null })),
  };
}

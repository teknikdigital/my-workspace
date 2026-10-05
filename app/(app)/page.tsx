import React from "react";
import { createClient } from "@/lib/supabase/server";
import { getTimeGreeting, formatDateIndo, formatDateTimeIndo } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskItemRow } from "@/components/tasks/TaskItemRow";
import Link from "next/link";
import {
  Briefcase,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Clock,
  PlusCircle,
  Activity,
} from "lucide-react";

export const revalidate = 0; // Fresh dynamic data

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .single();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "User";

  // 2. Active Projects & Last Opened Project
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("last_opened_at", { ascending: false, nullsFirst: false });

  const activeProjectsCount =
    projects?.filter((p) => p.status === "development" || p.status === "production" || p.status === "testing")
      .length || 0;

  const latestProject = projects && projects.length > 0 ? projects[0] : null;

  // 3. Tasks (Today, Overdue)
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: tasks } = await supabase
    .from("tasks")
    .select(`
      *,
      project:projects (id, name)
    `)
    .order("created_at", { ascending: false });

  const todayTasks =
    tasks?.filter((t) => t.status !== "done" && t.due_date === todayStr) || [];
  const overdueTasks =
    tasks?.filter((t) => t.status !== "done" && t.due_date && t.due_date < todayStr) || [];

  // 4. Recent Activities
  const { data: activities } = await supabase
    .from("activity_logs")
    .select(`
      *,
      project:projects (id, name)
    `)
    .order("created_at", { ascending: false })
    .limit(6);

  const greeting = getTimeGreeting();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Greeting Section */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            {greeting}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-mute">
            Sedang mengerjakan apa hari ini?
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/work/projects"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card/70 px-4 py-2 text-xs font-semibold text-ink hover:border-teal/50 hover:bg-card transition-all"
          >
            <Briefcase className="h-3.5 w-3.5 text-teal" />
            <span>Semua Project</span>
          </Link>
          <Link
            href="/work/tasks"
            className="inline-flex items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-teal-dark transition-all"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Task Baru</span>
          </Link>
        </div>
      </section>

      {/* 2. Lanjutkan Bekerja Panel */}
      {latestProject ? (
        <section className="panel-highlight rounded-panel border border-line bg-glass p-6 backdrop-blur-md shadow-soft">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal">
                  Lanjutkan Bekerja
                </span>
                <StatusBadge status={latestProject.status} />
              </div>
              <h2 className="text-xl font-bold text-ink">{latestProject.name}</h2>
              <p className="max-w-2xl text-xs md:text-sm text-mute line-clamp-2">
                {latestProject.description || "Tidak ada deskripsi project."}
              </p>
              {latestProject.last_opened_at && (
                <div className="flex items-center gap-1.5 text-[11px] text-mute">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Terakhir dibuka: {formatDateTimeIndo(latestProject.last_opened_at)}</span>
                </div>
              )}
            </div>

            <Link
              href={`/work/projects/${latestProject.id}`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-btn bg-gradient-to-r from-teal to-teal-dark px-5 py-3 text-xs md:text-sm font-bold text-white shadow-soft hover:opacity-95 transition-all"
            >
              <span>Buka Project</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="Belum ada project aktif"
          description="Mulai dengan membuat project pertamamu untuk mengatur aplikasi, database, dan task."
          actionLabel="Buat Project Sekarang"
        />
      )}

      {/* 3. Ringkasan Tiga Angka */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Project Aktif */}
        <div className="rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-mute">Project Aktif</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal/10 text-teal">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-ink">{activeProjectsCount}</div>
          <p className="mt-1 text-[11px] text-mute">Project dalam fase dev / testing / prod</p>
        </div>

        {/* Task Hari Ini */}
        <div className="rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-mute">Task Hari Ini</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-ink">{todayTasks.length}</div>
          <p className="mt-1 text-[11px] text-mute">Jatuh tempo hari ini ({formatDateIndo(todayStr)})</p>
        </div>

        {/* Task Terlambat */}
        <div className="rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-mute">Task Terlambat</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-ink">{overdueTasks.length}</div>
          <p className="mt-1 text-[11px] text-mute">Perlu perhatian dan tindak lanjut segera</p>
        </div>
      </section>

      {/* 4. Dua Kolom: Task Hari Ini & Aktivitas Terbaru */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: Task Hari Ini */}
        <div className="rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal" />
              <h3 className="text-base font-bold text-ink">Task Hari Ini</h3>
            </div>
            <Link
              href="/work/tasks"
              className="text-xs font-semibold text-teal hover:underline"
            >
              Lihat Semua
            </Link>
          </div>

          <div className="space-y-2">
            {todayTasks.length > 0 ? (
              todayTasks.slice(0, 5).map((task) => (
                <TaskItemRow key={task.id} task={task} />
              ))
            ) : (
              <div className="py-8 text-center text-xs text-mute">
                Tidak ada task yang jatuh tempo hari ini. Santai atau rencanakan task baru!
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Aktivitas Terbaru */}
        <div className="rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange" />
              <h3 className="text-base font-bold text-ink">Aktivitas Terbaru</h3>
            </div>
            <Link
              href="/work/activity"
              className="text-xs font-semibold text-teal hover:underline"
            >
              Riwayat
            </Link>
          </div>

          <div className="space-y-3">
            {activities && activities.length > 0 ? (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start gap-3 rounded-btn border border-line bg-card/60 p-3 hover:bg-card transition-all"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange mt-0.5">
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 truncate">
                    <p className="text-xs md:text-sm font-medium text-ink break-words">
                      {act.summary}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-mute">
                      {act.project && (
                        <span className="font-semibold text-teal">{act.project.name}</span>
                      )}
                      <span>•</span>
                      <span>{formatDateTimeIndo(act.created_at)}</span>
                      <span>•</span>
                      <span className="uppercase text-[9px] font-bold bg-line px-1.5 py-0.2 rounded">
                        {act.source}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-mute">
                Belum ada log aktivitas tercatat.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

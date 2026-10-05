"use client";

import React, { useState, useTransition } from "react";
import type { Task } from "@/types/database";
import { createTask, deleteTask } from "@/lib/actions/tasks";
import { TaskItemRow } from "@/components/tasks/TaskItemRow";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CheckSquare,
  PlusCircle,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface TasksClientProps {
  initialTasks: any[];
  projects: any[];
  applications: any[];
}

export function TasksClient({
  initialTasks,
  projects,
  applications,
}: TasksClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<any>("medium");
  const [status, setStatus] = useState<any>("todo");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const todayTasks = initialTasks.filter(
    (t) => t.status !== "done" && t.due_date === todayStr
  );
  const overdueTasks = initialTasks.filter(
    (t) => t.status !== "done" && t.due_date && t.due_date < todayStr
  );
  const upcomingTasks = initialTasks.filter(
    (t) =>
      t.status !== "done" &&
      (!t.due_date || t.due_date > todayStr) &&
      t.due_date !== todayStr
  );
  const doneTasks = initialTasks.filter((t) => t.status === "done");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createTask({
        title,
        description: description || undefined,
        priority,
        status,
        due_date: dueDate || undefined,
        project_id: projectId || undefined,
        application_id: applicationId || undefined,
        source: "manual",
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setTitle("");
        setDescription("");
        setPriority("medium");
        setStatus("todo");
        setDueDate("");
        setProjectId("");
        setApplicationId("");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Tasks</h1>
          <p className="text-xs sm:text-sm text-mute">
            Kelola prioritas pekerjaan harian, deadline, dan keterkaitan dengan project.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-teal px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Tambah Task</span>
        </button>
      </div>

      {initialTasks.length > 0 ? (
        <div className="space-y-8">
          {/* 1. TERLAMBAT (OVERDUE) */}
          {overdueTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red font-bold text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Terlambat ({overdueTasks.length})</span>
              </div>
              <div className="space-y-2">
                {overdueTasks.map((task) => (
                  <TaskItemRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* 2. HARI INI (TODAY) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-teal font-bold text-sm">
              <Clock className="h-4 w-4" />
              <span>Hari Ini ({todayTasks.length})</span>
            </div>
            {todayTasks.length > 0 ? (
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <TaskItemRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div className="rounded-btn border border-line bg-card/40 p-4 text-center text-xs text-mute">
                Tidak ada task yang jatuh tempo hari ini.
              </div>
            )}
          </div>

          {/* 3. MENDATANG (UPCOMING) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-ink font-bold text-sm">
              <Calendar className="h-4 w-4 text-purple-500" />
              <span>Mendatang ({upcomingTasks.length})</span>
            </div>
            {upcomingTasks.length > 0 ? (
              <div className="space-y-2">
                {upcomingTasks.map((task) => (
                  <TaskItemRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div className="rounded-btn border border-line bg-card/40 p-4 text-center text-xs text-mute">
                Tidak ada task mendatang yang belum selesai.
              </div>
            )}
          </div>

          {/* 4. SELESAI (DONE) */}
          {doneTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Selesai ({doneTasks.length})</span>
              </div>
              <div className="space-y-2">
                {doneTasks.map((task) => (
                  <TaskItemRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={CheckSquare}
          title="Belum ada task"
          description="Tambahkan pekerjaan harian, bug fix, atau fitur yang ingin kamu selesaikan."
          actionLabel="Buat Task Sekarang"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Tambah Task */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Task Baru"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Judul Task *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Perbaiki RLS inventory warehouse"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Prioritas
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="low">Rendah (Low)</option>
                <option value="medium">Sedang (Medium)</option>
                <option value="high">Tinggi (High)</option>
                <option value="urgent">Mendesak (Urgent)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Jatuh Tempo (Due Date)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
              </input>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Project Terkait
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="">-- Tanpa Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Aplikasi Terkait
              </label>
              <select
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="">-- Tanpa Aplikasi --</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Deskripsi / Catatan Tambahan
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail apa saja yang perlu dikerjakan..."
              className="w-full rounded-btn border border-line bg-card p-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          {formError && (
            <div className="rounded-btn bg-red/10 border border-red/20 p-2 text-xs font-semibold text-red">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-btn border border-line px-4 py-2 text-xs font-semibold text-mute hover:bg-line/20"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-btn bg-teal px-4 py-2 text-xs font-bold text-white hover:bg-teal-dark disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan Task</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

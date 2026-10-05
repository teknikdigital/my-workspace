"use client";

import React, { useState, useTransition } from "react";
import type { ActivityLog } from "@/types/database";
import { createActivity } from "@/lib/actions/activity";
import { formatDateTimeIndo } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Activity, PlusCircle, Loader2 } from "lucide-react";

interface ActivityClientProps {
  initialActivities: any[];
  projects: any[];
}

export function ActivityClient({
  initialActivities,
  projects,
}: ActivityClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [summary, setSummary] = useState("");
  const [projectId, setProjectId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createActivity(summary, projectId || undefined, "manual");
      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setSummary("");
        setProjectId("");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Activity Log</h1>
          <p className="text-xs sm:text-sm text-mute">
            Linimasa pekerjaan dan aktivitas yang tercatat di seluruh project.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-teal px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Catat Aktivitas</span>
        </button>
      </div>

      {initialActivities.length > 0 ? (
        <div className="relative pl-6 border-l-2 border-line space-y-6">
          {initialActivities.map((act) => (
            <div key={act.id} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal ring-4 ring-card" />

              <div className="rounded-panel border border-line bg-glass p-4 backdrop-blur-sm shadow-soft">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-teal">
                    {act.project ? act.project.name : "Workspace Global"}
                  </span>
                  <span className="text-[10px] text-mute">
                    {formatDateTimeIndo(act.created_at)}
                  </span>
                </div>
                <p className="text-sm font-medium text-ink">{act.summary}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider rounded bg-line px-2 py-0.5 text-mute">
                    Source: {act.source}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title="Belum ada aktivitas tercatat"
          description="Catat apa yang baru saja kamu selesaikan untuk memelihara konteks riwayat project."
          actionLabel="Catat Aktivitas Baru"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Catat Aktivitas */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Catat Aktivitas Baru"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Project Terkait
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            >
              <option value="">-- Workspace Global --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Ringkasan Aktivitas *
            </label>
            <textarea
              required
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="mis. Memperbaiki RLS pada tabel inventory dan testing query endpoint"
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
              <span>Simpan Aktivitas</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

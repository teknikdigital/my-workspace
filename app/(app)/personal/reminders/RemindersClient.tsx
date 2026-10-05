"use client";

import React, { useState, useTransition } from "react";
import type { ReminderItem } from "@/types/database";
import {
  createReminder,
  toggleReminder,
  deleteReminder,
} from "@/lib/actions/personal";
import { formatDateTimeIndo } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Bell,
  PlusCircle,
  Check,
  Trash2,
  Loader2,
  Clock,
  Calendar,
} from "lucide-react";

interface RemindersClientProps {
  initialReminders: ReminderItem[];
}

export function RemindersClient({ initialReminders }: RemindersClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const activeReminders = initialReminders.filter((r) => !r.is_completed);
  const completedReminders = initialReminders.filter((r) => r.is_completed);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createReminder({
        title,
        due_at: new Date(dueAt).toISOString(),
        source: "manual",
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setTitle("");
        setDueAt("");
      }
    });
  };

  const handleToggle = (id: string, isCompleted: boolean) => {
    startTransition(async () => {
      await toggleReminder(id, isCompleted);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteReminder(id);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Reminders</h1>
          <p className="text-xs sm:text-sm text-mute">
            Pengingat jadwal, deadline pribadi, dan agenda penting.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-purple-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-purple-700 transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Tambah Pengingat</span>
        </button>
      </div>

      {initialReminders.length > 0 ? (
        <div className="space-y-6">
          {/* Active Reminders */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <span>Pengingat Aktif ({activeReminders.length})</span>
            </h3>

            {activeReminders.length > 0 ? (
              <div className="space-y-2">
                {activeReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between gap-3 rounded-panel border border-line bg-glass p-4 backdrop-blur-sm shadow-soft hover:border-purple-500/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(rem.id, rem.is_completed)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-mute hover:border-purple-600 hover:bg-purple-500/10 transition-all"
                      >
                        {rem.is_completed && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div>
                        <h4 className="text-sm font-bold text-ink">{rem.title}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-mute mt-0.5">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDateTimeIndo(rem.due_at)}</span>
                          <span>•</span>
                          <span className="uppercase text-[9px] font-bold bg-line px-1.5 rounded">
                            {rem.source}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(rem.id)}
                      className="rounded p-1 text-mute hover:text-red hover:bg-red/10 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-btn border border-line bg-card/40 p-4 text-center text-xs text-mute">
                Tidak ada pengingat aktif saat ini.
              </div>
            )}
          </div>

          {/* Completed Reminders */}
          {completedReminders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-mute flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>Selesai ({completedReminders.length})</span>
              </h3>

              <div className="space-y-2 opacity-60">
                {completedReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between gap-3 rounded-panel border border-line bg-line/10 p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(rem.id, rem.is_completed)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white"
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </button>
                      <span className="text-xs line-through text-mute">{rem.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(rem.id)}
                      className="rounded p-1 text-mute hover:text-red"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="Belum ada pengingat"
          description="Atur pengingat agenda, notifikasi jadwal meeting, atau reminder personal."
          actionLabel="Tambah Pengingat Baru"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Tambah Reminder */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Pengingat Baru"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Judul Pengingat *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Cek backup database Supabase & server invoice"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Waktu & Tanggal Pengingat *
            </label>
            <input
              type="datetime-local"
              required
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-purple-500 focus:outline-none"
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
              className="flex items-center gap-2 rounded-btn bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan Pengingat</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

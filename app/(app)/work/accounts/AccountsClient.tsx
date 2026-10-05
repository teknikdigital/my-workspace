"use client";

import React, { useState, useTransition } from "react";
import type { Account } from "@/types/database";
import { createAccount, deleteAccount } from "@/lib/actions/accounts";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Users,
  PlusCircle,
  Trash2,
  Loader2,
  Briefcase,
  Layers,
  CheckCircle2,
} from "lucide-react";

interface AccountsClientProps {
  initialAccounts: any[];
  services: any[];
}

export function AccountsClient({
  initialAccounts,
  services,
}: AccountsClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [label, setLabel] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [notes, setNotes] = useState("");
  const [isPersonal, setIsPersonal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Group accounts by service
  const groupedByService: Record<string, any[]> = {};
  for (const acc of initialAccounts) {
    const serviceName = acc.service?.name || "Lainnya";
    if (!groupedByService[serviceName]) groupedByService[serviceName] = [];
    groupedByService[serviceName].push(acc);
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createAccount({
        label,
        identifier,
        service_id: serviceId || undefined,
        notes: notes || undefined,
        is_personal: isPersonal,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setLabel("");
        setIdentifier("");
        setServiceId("");
        setNotes("");
        setIsPersonal(false);
      }
    });
  };

  const handleDelete = (id: string, label: string) => {
    if (confirm(`Hapus akun "${label}"?`)) {
      startTransition(async () => {
        await deleteAccount(id);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Accounts</h1>
          <p className="text-xs sm:text-sm text-mute">
            Katalog akun layanan (Google, GitHub, Supabase, Vercel) dan hubungan ke project.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-teal px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Tambah Akun</span>
        </button>
      </div>

      {/* Grouped Accounts */}
      {Object.keys(groupedByService).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedByService).map(([serviceName, accounts]) => (
            <div key={serviceName} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal/10 text-teal text-xs font-bold">
                  {serviceName.slice(0, 1)}
                </span>
                <h2 className="text-base font-bold text-ink">{serviceName}</h2>
                <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-bold text-mute">
                  {accounts.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((acc) => {
                  const linkedProjects = acc.project_accounts || [];
                  const linkedApps = acc.application_accounts || [];

                  return (
                    <div
                      key={acc.id}
                      className="flex flex-col justify-between rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-teal/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-bold text-teal uppercase">
                            {acc.is_personal ? "Pribadi" : "Pekerjaan"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(acc.id, acc.label)}
                            className="rounded p-1 text-mute hover:text-red hover:bg-red/10 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <h3 className="text-base font-bold text-ink">{acc.label}</h3>
                        <p className="text-xs font-medium text-teal mt-0.5">{acc.identifier}</p>

                        {acc.notes && (
                          <p className="mt-2 text-xs text-mute">{acc.notes}</p>
                        )}

                        {/* Linked Projects Multi-Relational Tree */}
                        <div className="mt-4 border-t border-line pt-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-mute flex items-center gap-1 mb-2">
                            <Briefcase className="h-3 w-3" />
                            <span>Dipakai di Project:</span>
                          </span>

                          {linkedProjects.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {linkedProjects.map((lp: any) => (
                                <span
                                  key={lp.project?.id || Math.random()}
                                  className="rounded bg-line/80 px-2 py-0.5 text-[10px] font-semibold text-ink"
                                >
                                  {lp.project?.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-mute italic">
                              Belum ditautkan ke project spesifik
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="Belum ada akun terdaftar"
          description="Catat akun Google, GitHub, Supabase, atau Vercel yang kamu gunakan untuk mengelola banyak project."
          actionLabel="Tambah Akun Baru"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Tambah Akun */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Akun Baru"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Label Akun *
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="mis. Gmail Utama Development"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Identifier (Email / Username) *
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="mis. dev.workspace@gmail.com atau @octodev"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Layanan / Service
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            >
              <option value="">-- Pilih Layanan --</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={isPersonal}
                onChange={(e) => setIsPersonal(e.target.checked)}
                className="rounded border-line text-teal focus:ring-teal"
              />
              <span>Ini akun pribadi (Personal)</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Catatan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kegunaan akun, quota, billing info..."
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
              <span>Simpan Akun</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

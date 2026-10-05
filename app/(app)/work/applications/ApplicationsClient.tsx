"use client";

import React, { useState, useTransition } from "react";
import type { Application } from "@/types/database";
import { createApplication, deleteApplication } from "@/lib/actions/applications";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Layers,
  PlusCircle,
  ExternalLink,
  Trash2,
  Loader2,
  Database,
  GitBranch,
  Globe,
  Users,
} from "lucide-react";

interface ApplicationsClientProps {
  initialApplications: any[];
  projects: any[];
}

export function ApplicationsClient({
  initialApplications,
  projects,
}: ApplicationsClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState<any>("nextjs");
  const [framework, setFramework] = useState("");
  const [productionUrl, setProductionUrl] = useState("");
  const [stagingUrl, setStagingUrl] = useState("");
  const [status, setStatus] = useState<any>("development");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createApplication({
        name,
        project_id: projectId || undefined,
        type,
        framework,
        production_url: productionUrl || undefined,
        staging_url: stagingUrl || undefined,
        status,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setName("");
        setProjectId("");
        setType("nextjs");
        setFramework("");
        setProductionUrl("");
        setStagingUrl("");
        setStatus("development");
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Hapus aplikasi "${name}"?`)) {
      startTransition(async () => {
        await deleteApplication(id);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Applications</h1>
          <p className="text-xs sm:text-sm text-mute">
            Daftar aplikasi web, mobile, script otomatis, dan backend yang dibangun.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-teal px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Tambah Aplikasi</span>
        </button>
      </div>

      {/* Applications List */}
      {initialApplications.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {initialApplications.map((app) => {
            const resources = app.application_resources || [];
            const accounts = app.application_accounts || [];

            const dbRes = resources.find((r: any) => r.role === "database");
            const repoRes = resources.find((r: any) => r.role === "repository");
            const deployRes = resources.find((r: any) => r.role === "deployment");

            return (
              <div
                key={app.id}
                className="flex flex-col justify-between rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-teal/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold text-teal uppercase tracking-wider">
                      {app.type}
                    </span>
                    <StatusBadge status={app.status} />
                  </div>

                  <h3 className="text-lg font-bold text-ink">{app.name}</h3>

                  {app.project && (
                    <div className="mt-1 text-xs text-mute">
                      Project: <span className="font-semibold text-teal">{app.project.name}</span>
                    </div>
                  )}

                  {app.framework && (
                    <div className="mt-1 text-xs text-mute">
                      Framework / Stack: <span className="text-ink font-medium">{app.framework}</span>
                    </div>
                  )}

                  {/* Architecture Links: DB, Repo, Deployment, Account */}
                  <div className="mt-4 space-y-2 rounded-btn border border-line bg-card/60 p-3 text-xs">
                    {/* Database */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-mute font-medium">
                        <Database className="h-3.5 w-3.5 text-teal" />
                        <span>Database</span>
                      </span>
                      {dbRes ? (
                        <a
                          href={dbRes.resources?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-teal hover:underline flex items-center gap-1 truncate max-w-[180px]"
                        >
                          <span className="truncate">{dbRes.resources?.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-mute">-</span>
                      )}
                    </div>

                    {/* Repository */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-mute font-medium">
                        <GitBranch className="h-3.5 w-3.5 text-orange" />
                        <span>Repository</span>
                      </span>
                      {repoRes ? (
                        <a
                          href={repoRes.resources?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-teal hover:underline flex items-center gap-1 truncate max-w-[180px]"
                        >
                          <span className="truncate">{repoRes.resources?.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-mute">-</span>
                      )}
                    </div>

                    {/* Deployment / Production URL */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-mute font-medium">
                        <Globe className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Production URL</span>
                      </span>
                      {app.production_url || deployRes ? (
                        <a
                          href={app.production_url || deployRes?.resources?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-teal hover:underline flex items-center gap-1 truncate max-w-[180px]"
                        >
                          <span className="truncate">{app.production_url || deployRes?.resources?.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-mute">-</span>
                      )}
                    </div>

                    {/* Account */}
                    {accounts.length > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-mute font-medium">
                          <Users className="h-3.5 w-3.5 text-purple-500" />
                          <span>Akun Terkait</span>
                        </span>
                        <span className="font-semibold text-ink truncate max-w-[180px]">
                          {accounts[0]?.accounts?.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="text-[11px] text-mute">
                    {app.staging_url ? "Staging tersedia" : "Single environment"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(app.id, app.name)}
                    className="rounded p-1 text-mute hover:text-red hover:bg-red/10 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Layers}
          title="Belum ada aplikasi"
          description="Tambahkan aplikasi yang sedang kamu buat (Next.js, Apps Script, PWA, backend) dan hubungkan dengan project."
          actionLabel="Tambah Aplikasi Baru"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Tambah Aplikasi */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Aplikasi Baru"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Nama Aplikasi *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Warehouse Web App"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Tipe Aplikasi
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="nextjs">Next.js</option>
                <option value="apps_script">Apps Script</option>
                <option value="pwa">PWA</option>
                <option value="streamlit">Streamlit</option>
                <option value="static">Static Site</option>
                <option value="backend">Backend / API</option>
                <option value="other">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="planning">Planning</option>
                <option value="development">Development</option>
                <option value="testing">Testing</option>
                <option value="production">Production</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Framework / Stack
            </label>
            <input
              type="text"
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              placeholder="mis. Next.js 14 App Router, TypeScript"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Production URL
            </label>
            <input
              type="url"
              value={productionUrl}
              onChange={(e) => setProductionUrl(e.target.value)}
              placeholder="https://app.workspace.io"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Staging URL
            </label>
            <input
              type="url"
              value={stagingUrl}
              onChange={(e) => setStagingUrl(e.target.value)}
              placeholder="https://staging.workspace.io"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
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
              <span>Simpan Aplikasi</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

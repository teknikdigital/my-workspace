"use client";

import React, { useState, useTransition } from "react";
import type { Project } from "@/types/database";
import { createProject, deleteProject } from "@/lib/actions/projects";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import {
  PlusCircle,
  Search,
  Briefcase,
  Layers,
  Link2,
  Trash2,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface ProjectsClientProps {
  initialProjects: any[];
}

export function ProjectsClient({ initialProjects }: ProjectsClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // New Project Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<any>("planning");
  const [progress, setProgress] = useState(0);
  const [techStackStr, setTechStackStr] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const filteredProjects = initialProjects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const tech_stack = techStackStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startTransition(async () => {
      const res = await createProject({
        name,
        description,
        category,
        status,
        progress: Number(progress),
        tech_stack,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setName("");
        setDescription("");
        setCategory("");
        setStatus("planning");
        setProgress(0);
        setTechStackStr("");
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Hapus project "${name}" beserta semua relasinya?`)) {
      startTransition(async () => {
        await deleteProject(id);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Projects</h1>
          <p className="text-xs sm:text-sm text-mute">
            Kelola semua sistem, aplikasi, dan inisiatif digital dalam satu tempat.
          </p>
        </div>

        <button
          type="button"
          id="btn-add-project"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-teal px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Tambah Project</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-mute" />
          <input
            type="text"
            placeholder="Cari nama project, deskripsi, atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-full border border-line bg-glass pl-10 pr-4 text-xs sm:text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none backdrop-blur-md transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {["all", "planning", "development", "testing", "production", "maintenance", "archived"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === st
                  ? "bg-teal text-white shadow-sm"
                  : "border border-line bg-card/60 text-mute hover:bg-card"
              }`}
            >
              {st === "all" ? "Semua Status" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const appCount = project.applications?.length || 0;
            const resCount = project.project_resources?.length || 0;

            return (
              <div
                key={project.id}
                className="group relative flex flex-col justify-between rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-teal/40 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold text-teal uppercase tracking-wider">
                      {project.category || "General"}
                    </span>
                    <StatusBadge status={project.status} />
                  </div>

                  <Link href={`/work/projects/${project.id}`} className="block">
                    <h3 className="text-base font-bold text-ink group-hover:text-teal transition-colors">
                      {project.name}
                    </h3>
                  </Link>

                  <p className="mt-1 text-xs text-mute line-clamp-2">
                    {project.description || "Tidak ada deskripsi project."}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-mute">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className="h-full bg-teal transition-all"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Tech Stack Tags */}
                  {project.tech_stack && project.tech_stack.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {project.tech_stack.map((tech: string) => (
                        <span
                          key={tech}
                          className="rounded bg-line/60 px-2 py-0.5 text-[10px] font-medium text-mute"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Metrics & Actions */}
                <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs text-mute">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1" title="Aplikasi">
                      <Layers className="h-3.5 w-3.5 text-orange" />
                      <span>{appCount}</span>
                    </span>
                    <span className="flex items-center gap-1" title="Resources">
                      <Link2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{resCount}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(project.id, project.name)}
                      title="Hapus Project"
                      className="rounded p-1 text-mute hover:text-red hover:bg-red/10 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      href={`/work/projects/${project.id}`}
                      className="flex items-center gap-1 font-semibold text-teal hover:underline"
                    >
                      <span>Buka</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          title={search ? "Project tidak ditemukan" : "Belum ada project"}
          description={
            search
              ? `Tidak ada project yang cocok dengan kata kunci "${search}".`
              : "Buat project pertamamu untuk mengorganisir resource, database, aplikasi, dan task terkait."
          }
          actionLabel="Tambah Project Baru"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Tambah Project */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Project Baru"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Nama Project *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Warehouse Monitoring"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Kategori
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="mis. Logistics / Utilities"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Deskripsi
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tujuan atau cakupan project..."
              className="w-full rounded-btn border border-line bg-card p-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="planning">Perencanaan (Planning)</option>
                <option value="development">Pengembangan (Dev)</option>
                <option value="testing">Pengujian (Testing)</option>
                <option value="production">Produksi (Production)</option>
                <option value="maintenance">Pemeliharaan</option>
                <option value="archived">Arsip</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Progress ({progress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full mt-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Tech Stack (Pisahkan dengan koma)
            </label>
            <input
              type="text"
              value={techStackStr}
              onChange={(e) => setTechStackStr(e.target.value)}
              placeholder="mis. Next.js, Supabase, Tailwind, Apps Script"
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
              <span>Simpan Project</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

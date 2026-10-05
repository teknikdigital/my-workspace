"use client";

import React, { useState, useTransition } from "react";
import type { Note } from "@/types/database";
import { createNote, deleteNote } from "@/lib/actions/notes";
import { formatDateTimeIndo } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  FileText,
  PlusCircle,
  Trash2,
  Loader2,
  Search,
  Tag,
} from "lucide-react";

interface NotesClientProps {
  initialNotes: any[];
}

export function NotesClient({ initialNotes }: NotesClientProps) {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<any>("work");
  const [formError, setFormError] = useState<string | null>(null);

  const filteredNotes = initialNotes.filter((note) => {
    const matchesSearch =
      (note.title && note.title.toLowerCase().includes(search.toLowerCase())) ||
      (note.body && note.body.toLowerCase().includes(search.toLowerCase()));

    const matchesScope = scopeFilter === "all" || note.scope === scopeFilter;
    return matchesSearch && matchesScope;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createNote({
        title: title || undefined,
        body,
        scope,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setTitle("");
        setBody("");
        setScope("work");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Hapus catatan ini?")) {
      startTransition(async () => {
        await deleteNote(id);
      });
    }
  };

  const getScopeBadgeClass = (s: string) => {
    switch (s) {
      case "personal":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "project":
        return "bg-teal/10 text-teal dark:text-teal-400 border-teal/20";
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Notes</h1>
          <p className="text-xs sm:text-sm text-mute">
            Catatan kerja, ide personal, dan dokumentasi arsitektur project.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-teal px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Buat Catatan</span>
        </button>
      </div>

      {/* Search & Scope Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-mute" />
          <input
            type="text"
            placeholder="Cari dalam catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-full border border-line bg-glass pl-10 pr-4 text-xs sm:text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none backdrop-blur-md transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {["all", "work", "project", "personal"].map((sc) => (
            <button
              key={sc}
              onClick={() => setScopeFilter(sc)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap capitalize transition-all ${
                scopeFilter === sc
                  ? "bg-teal text-white shadow-sm"
                  : "border border-line bg-card/60 text-mute hover:bg-card"
              }`}
            >
              {sc === "all" ? "Semua Scope" : sc}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="flex flex-col justify-between rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-teal/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getScopeBadgeClass(
                      note.scope
                    )}`}
                  >
                    {note.scope}
                  </span>
                  <span className="text-[10px] text-mute">
                    {formatDateTimeIndo(note.created_at)}
                  </span>
                </div>

                <h3 className="text-base font-bold text-ink">
                  {note.title || "Catatan tanpa judul"}
                </h3>
                <p className="mt-2 text-xs text-mute whitespace-pre-wrap line-clamp-6 leading-relaxed">
                  {note.body}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-end border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => handleDelete(note.id)}
                  className="rounded p-1 text-mute hover:text-red hover:bg-red/10 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title={search ? "Catatan tidak ditemukan" : "Belum ada catatan"}
          description={
            search
              ? `Tidak ada catatan yang cocok dengan pencarian "${search}".`
              : "Catat snippet kode, konfigurasi environment, ide, atau catatan meeting."
          }
          actionLabel="Buat Catatan Baru"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Tambah Catatan */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Buat Catatan Baru"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Judul Catatan
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Struktur Database & Konfigurasi Auth"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Cakupan (Scope)
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            >
              <option value="work">Work (Pekerjaan Umum)</option>
              <option value="project">Project (Terkait Sistem)</option>
              <option value="personal">Personal (Pribadi)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Isi Catatan *
            </label>
            <textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tulis catatanmu di sini..."
              className="w-full rounded-btn border border-line bg-card p-3 text-sm text-ink focus:border-teal focus:outline-none font-mono text-xs"
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
              <span>Simpan Catatan</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

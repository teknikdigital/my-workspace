"use client";

import React, { useState, useTransition } from "react";
import type { Resource } from "@/types/database";
import { createResource, deleteResource } from "@/lib/actions/resources";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Link2,
  PlusCircle,
  ExternalLink,
  Trash2,
  Loader2,
  Search,
  Filter,
} from "lucide-react";

interface ResourcesClientProps {
  initialResources: any[];
  accounts: any[];
}

export function ResourcesClient({
  initialResources,
  accounts,
}: ResourcesClientProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<any>("supabase");
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const categories = [
    "all",
    "github",
    "supabase",
    "vercel",
    "apps_script",
    "google_sheet",
    "google_drive",
    "figma",
    "postman",
    "documentation",
    "production",
    "staging",
    "other",
  ];

  const filteredResources = initialResources.filter((res) => {
    const matchesSearch =
      res.title.toLowerCase().includes(search.toLowerCase()) ||
      res.url.toLowerCase().includes(search.toLowerCase()) ||
      (res.notes && res.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === "all" || res.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createResource({
        title,
        url,
        category,
        account_id: accountId || undefined,
        notes: notes || undefined,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setTitle("");
        setUrl("");
        setCategory("supabase");
        setAccountId("");
        setNotes("");
      }
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Hapus resource "${title}"?`)) {
      startTransition(async () => {
        await deleteResource(id);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Resources</h1>
          <p className="text-xs sm:text-sm text-mute">
            Katalog tautan dashboard, repository, database, spreadsheet, dan dokumentasi.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-teal px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Tambah Resource</span>
        </button>
      </div>

      {/* Search and Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-mute" />
          <input
            type="text"
            placeholder="Cari resource berdasarkan judul, URL, atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-full border border-line bg-glass pl-10 pr-4 text-xs sm:text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none backdrop-blur-md transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap capitalize transition-all ${
                categoryFilter === cat
                  ? "bg-teal text-white shadow-sm"
                  : "border border-line bg-card/60 text-mute hover:bg-card"
              }`}
            >
              {cat === "all" ? "Semua Kategori" : cat.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Resources Grid */}
      {filteredResources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((res) => (
            <div
              key={res.id}
              className="flex flex-col justify-between rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-teal/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal">
                    {res.category?.replace("_", " ")}
                  </span>
                  {res.account && (
                    <span className="text-[10px] font-medium text-mute truncate max-w-[120px]">
                      {res.account.label}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-ink">{res.title}</h3>
                {res.notes && (
                  <p className="mt-1 text-xs text-mute line-clamp-2">{res.notes}</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <a
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline truncate max-w-[200px]"
                >
                  <span className="truncate">{res.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>

                <button
                  type="button"
                  onClick={() => handleDelete(res.id, res.title)}
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
          icon={Link2}
          title={search ? "Resource tidak ditemukan" : "Belum ada resource"}
          description={
            search
              ? `Tidak ada resource yang cocok dengan kriteria pencarian "${search}".`
              : "Simpan tautan penting seperti Supabase Dashboard, Google Sheets, GitHub Repo, dan Vercel."
          }
          actionLabel="Tambah Resource Baru"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Tambah Resource */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Resource Baru"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Judul Resource *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Supabase Warehouse DB"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              URL Link (Harus diawali http:// atau https://) *
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://supabase.com/dashboard/project/..."
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="supabase">Supabase</option>
                <option value="github">GitHub</option>
                <option value="vercel">Vercel</option>
                <option value="apps_script">Apps Script</option>
                <option value="google_sheet">Google Sheet</option>
                <option value="google_drive">Google Drive</option>
                <option value="figma">Figma</option>
                <option value="postman">Postman</option>
                <option value="documentation">Documentation</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Akun Terkait
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="">-- Tanpa Akun --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label} ({acc.identifier})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Catatan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan mengenai resource ini..."
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
              <span>Simpan Resource</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

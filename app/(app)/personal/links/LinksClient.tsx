"use client";

import React, { useState, useTransition } from "react";
import type { PersonalLink } from "@/types/database";
import { createPersonalLink, deletePersonalLink } from "@/lib/actions/personal";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Bookmark,
  PlusCircle,
  ExternalLink,
  Trash2,
  Loader2,
  Search,
} from "lucide-react";

interface LinksClientProps {
  initialLinks: PersonalLink[];
}

export function LinksClient({ initialLinks }: LinksClientProps) {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const filteredLinks = initialLinks.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.url.toLowerCase().includes(search.toLowerCase()) ||
      (l.notes && l.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startTransition(async () => {
      const res = await createPersonalLink({
        title,
        url,
        tags,
        notes: notes || undefined,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setTitle("");
        setUrl("");
        setTagsStr("");
        setNotes("");
      }
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Hapus link "${title}"?`)) {
      startTransition(async () => {
        await deletePersonalLink(id);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Personal Links</h1>
          <p className="text-xs sm:text-sm text-mute">
            Kumpulan tautan dan bookmark referensi penting pribadi.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-purple-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-purple-700 transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Tambah Link</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-mute" />
        <input
          type="text"
          placeholder="Cari dalam tautan pribadi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 rounded-full border border-line bg-glass pl-10 pr-4 text-xs sm:text-sm text-ink placeholder:text-mute focus:border-purple-500 focus:outline-none backdrop-blur-md transition-all"
        />
      </div>

      {filteredLinks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map((link) => (
            <div
              key={link.id}
              className="flex flex-col justify-between rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-purple-500/40 transition-all"
            >
              <div>
                <h3 className="text-base font-bold text-ink">{link.title}</h3>
                {link.notes && <p className="mt-1 text-xs text-mute">{link.notes}</p>}

                {link.tags && link.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {link.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-semibold"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline truncate max-w-[200px]"
                >
                  <span className="truncate">{link.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>

                <button
                  type="button"
                  onClick={() => handleDelete(link.id, link.title)}
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
          icon={Bookmark}
          title="Belum ada tautan"
          description="Simpan bookmark artikel, tutorial, dan portal pribadi."
          actionLabel="Tambah Link Baru"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Tambah Link */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Tautan Pribadi"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Judul Link *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Dokumentasi Supabase SSR & RLS"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              URL * (Diawali http:// atau https://)
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Tag (Pisahkan dengan koma)
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="mis. dev, docs, supabase"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Catatan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Deskripsi singkat tautan..."
              className="w-full rounded-btn border border-line bg-card p-3 text-sm text-ink focus:border-purple-500 focus:outline-none"
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
              <span>Simpan Link</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

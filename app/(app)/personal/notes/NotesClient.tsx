"use client";

import React, { useState, useTransition } from "react";
import { createNote, deleteNote } from "@/lib/actions/notes";
import { smartFormatNote } from "@/lib/actions/aiNotes";
import { formatDateTimeIndo } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  FileText,
  PlusCircle,
  Trash2,
  Loader2,
  Search,
  Sparkles,
  Tag,
  Pin,
} from "lucide-react";

interface NotesClientProps {
  initialNotes: any[];
}

export function NotesClient({ initialNotes }: NotesClientProps) {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(
      initialNotes.flatMap((n) => (Array.isArray(n.tags) ? n.tags : []))
    )
  );

  const filteredNotes = initialNotes.filter((note) => {
    const textContent = note.content || note.body || "";
    const noteTitle = note.title || "";
    const matchesSearch =
      noteTitle.toLowerCase().includes(search.toLowerCase()) ||
      textContent.toLowerCase().includes(search.toLowerCase()) ||
      (Array.isArray(note.tags) &&
        note.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase())));

    const matchesTag =
      selectedTag === "all" ||
      (Array.isArray(note.tags) && note.tags.includes(selectedTag));

    return matchesSearch && matchesTag;
  });

  const handleAiSmartPolish = async () => {
    if (!content.trim()) {
      setFormError("Tuliskan beberapa poin catatan terlebih dahulu agar AI bisa merapikannya.");
      return;
    }

    setFormError(null);
    setIsAiLoading(true);

    try {
      const res = await smartFormatNote(content);
      if (res.error) {
        setFormError(res.error);
      } else {
        if (!title.trim() || title === "Catatan Baru") {
          setTitle(res.title);
        }
        setContent(res.content);
        if (res.tags && res.tags.length > 0) {
          setTags(Array.from(new Set([...tags, ...res.tags])));
        }
      }
    } catch {
      setFormError("Gagal menghubungi AI Assistant.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase().replace(/^#/, "");
      if (!tags.includes(cleaned)) {
        setTags([...tags, cleaned]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim() && !content.trim()) {
      setFormError("Judul atau isi catatan tidak boleh kosong.");
      return;
    }

    startTransition(async () => {
      const res = await createNote({
        title: title || undefined,
        content,
        tags,
        is_pinned: isPinned,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsModalOpen(false);
        setTitle("");
        setContent("");
        setTags([]);
        setIsPinned(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Catatan & Dokumen Cerdas</h1>
          <p className="text-xs sm:text-sm text-mute">
            Simpan catatan, ide kerja, dan arsitektur dengan bantuan AI formatting otomatis.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-[#28849E] hover:bg-[#207289] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Buat Catatan</span>
        </button>
      </div>

      {/* Search & Tag Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-mute" />
          <input
            type="text"
            placeholder="Cari catatan, topik, atau isi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-full border border-line bg-glass pl-10 pr-4 text-xs sm:text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none backdrop-blur-md transition-all"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedTag("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                selectedTag === "all"
                  ? "bg-[#28849E] text-white shadow-sm"
                  : "border border-line bg-card/60 text-mute hover:bg-card"
              }`}
            >
              Semua Tag
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTag(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedTag === t
                    ? "bg-[#28849E] text-white shadow-sm"
                    : "border border-line bg-card/60 text-mute hover:bg-card"
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => {
            const textContent = note.content || note.body || "";
            return (
              <div
                key={note.id}
                className="flex flex-col justify-between rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-teal/40 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {note.is_pinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          <Pin className="h-3 w-3 fill-current" /> Pinned
                        </span>
                      )}
                      {Array.isArray(note.tags) &&
                        note.tags.map((t: string) => (
                          <span
                            key={t}
                            className="inline-flex items-center text-[10px] font-semibold text-teal bg-teal/10 border border-teal/20 px-2 py-0.5 rounded-full"
                          >
                            #{t}
                          </span>
                        ))}
                    </div>
                    <span className="text-[10px] text-mute shrink-0">
                      {formatDateTimeIndo(note.created_at)}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-ink group-hover:text-teal transition-colors">
                    {note.title || "Catatan tanpa judul"}
                  </h3>
                  <p className="mt-2 text-xs text-mute whitespace-pre-wrap line-clamp-6 leading-relaxed">
                    {textContent}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-end border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    className="rounded p-1 text-mute hover:text-red hover:bg-red/10 transition-all"
                    title="Hapus catatan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title={search ? "Catatan tidak ditemukan" : "Belum ada catatan"}
          description={
            search
              ? "Coba kata kunci pencarian yang lain."
              : "Buat catatan baru atau minta AI Assistant untuk merapikan draf ide Anda."
          }
          actionLabel="Buat Catatan Baru"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Buat Catatan */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Buat Catatan Baru"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="rounded-btn border border-red/20 bg-red/10 p-3 text-xs font-semibold text-red">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider">
              Judul Catatan
            </label>
            <input
              type="text"
              placeholder="Contoh: Arsitektur Database & Migrasi..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 rounded-btn border border-line bg-card/80 px-3 text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-ink uppercase tracking-wider">
                Isi Catatan
              </label>
              <button
                type="button"
                onClick={handleAiSmartPolish}
                disabled={isAiLoading || !content.trim()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#28849E] hover:text-[#1e6c82] disabled:opacity-50 transition-colors"
                title="Rapikan catatan dan buat tag otomatis dengan AI"
              >
                {isAiLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>AI Merapikan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>✨ Rapikan dengan AI</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={6}
              placeholder="Tuliskan isi catatan atau draf bebas di sini. Klik '✨ Rapikan dengan AI' untuk memformat otomatis..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="w-full rounded-btn border border-line bg-card/80 p-3 text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider">
              Tags (Tekan Enter)
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-xs font-semibold bg-teal/10 text-teal border border-teal/20 px-2 py-0.5 rounded-full"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-red transition-colors ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Ketik tag lalu tekan Enter (contoh: nextjs, redis, backend)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-full h-10 rounded-btn border border-line bg-card/80 px-3 text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_pinned"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-line text-teal focus:ring-teal"
            />
            <label htmlFor="is_pinned" className="text-xs font-medium text-ink cursor-pointer select-none">
              Sematkan catatan ini di atas (Pin to top)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-btn border border-line bg-card px-4 py-2 text-xs font-bold text-ink hover:bg-line transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-btn bg-[#28849E] hover:bg-[#207289] px-4 py-2 text-xs font-bold text-white shadow-soft hover:opacity-95 disabled:opacity-60 transition-all"
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

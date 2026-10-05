"use client";

import React, { useState, useTransition } from "react";
import type { DocumentItem } from "@/types/database";
import {
  createDocumentRecord,
  deleteDocument,
  getDocumentSignedUrl,
} from "@/lib/actions/personal";
import { createClient } from "@/lib/supabase/client";
import { formatDateTimeIndo } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  FolderArchive,
  PlusCircle,
  Download,
  Trash2,
  File,
  Loader2,
  Lock,
} from "lucide-react";

interface DocumentsClientProps {
  initialDocuments: DocumentItem[];
}

export function DocumentsClient({ initialDocuments }: DocumentsClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFormError("Pilih file yang akan diunggah");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Tidak terautentikasi");

        const fileExt = file.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        // Upload to private Supabase Storage bucket 'documents'
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Record in database
        const res = await createDocumentRecord({
          title,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          category,
        });

        if (res.error) throw new Error(res.error);

        setIsModalOpen(false);
        setTitle("");
        setFile(null);
        setCategory("general");
      } catch (err: any) {
        setFormError(err.message || "Gagal mengunggah dokumen.");
      }
    });
  };

  const handleDownload = async (doc: DocumentItem) => {
    setDownloadingId(doc.id);
    try {
      const res = await getDocumentSignedUrl(doc.file_path);
      if (res.signedUrl) {
        window.open(res.signedUrl, "_blank");
      } else {
        alert(res.error || "Gagal mendapatkan link download");
      }
    } catch {
      alert("Gagal mengunduh dokumen");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (doc: DocumentItem) => {
    if (confirm(`Hapus dokumen "${doc.title}"?`)) {
      startTransition(async () => {
        await deleteDocument(doc.id, doc.file_path);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">Documents</h1>
            <span className="flex items-center gap-1 rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
              <Lock className="h-3 w-3" />
              Private Storage
            </span>
          </div>
          <p className="text-xs sm:text-sm text-mute mt-0.5">
            Arsip dokumen pribadi, file spesifikasi, dan lampiran aman dengan signed URL.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-purple-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-purple-700 transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Upload Dokumen</span>
        </button>
      </div>

      {initialDocuments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col justify-between rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-purple-500/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    {doc.category || "General"}
                  </span>
                  <span className="text-[10px] text-mute">
                    {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ""}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 shrink-0 mt-0.5">
                    <File className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink break-words">{doc.title}</h3>
                    <p className="text-[11px] text-mute mt-0.5">
                      {formatDateTimeIndo(doc.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:text-purple-600 transition-all"
                >
                  {downloadingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(doc)}
                  className="rounded p-1 text-mute hover:text-red hover:bg-red/10 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderArchive}
          title="Belum ada dokumen"
          description="Simpan dokumen penting, PDF arsitektur, atau backup catatan di Supabase Storage pribadi."
          actionLabel="Upload Dokumen Pertama"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Modal Upload */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Upload Dokumen Baru"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Judul Dokumen *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Dokumen Spesifikasi Sistem Warehouse"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-purple-500 focus:outline-none"
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
              placeholder="mis. architecture / specification / personal"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Pilih File *
            </label>
            <input
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-ink file:mr-3 file:rounded-btn file:border-0 file:bg-purple-500/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-purple-600 hover:file:bg-purple-500/20 cursor-pointer"
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
              <span>Upload ke Storage</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

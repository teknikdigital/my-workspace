import React from "react";
import { FolderArchive } from "lucide-react";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Documents</h1>
        <p className="text-xs sm:text-sm text-mute">
          Arsip dokumen pribadi, file spesifikasi, dan lampiran project.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-panel border border-line bg-glass p-12 text-center backdrop-blur-md shadow-soft">
        <FolderArchive className="h-10 w-10 text-purple-600 mb-3" />
        <h3 className="text-base font-bold text-ink">Dokumen & Lampiran</h3>
        <p className="mt-1 text-xs text-mute max-w-sm">
          Penyimpanan dokumen private dengan signed URL Supabase Storage.
        </p>
      </div>
    </div>
  );
}

import React from "react";
import { ShieldCheck } from "lucide-react";

export default function VaultPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Credentials Vault</h1>
          <p className="text-xs sm:text-sm text-mute">
            Penyimpanan terenkripsi untuk API key, database secret, token, dan password.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-panel border border-line bg-glass p-12 text-center backdrop-blur-md shadow-soft">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 text-teal mb-4">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-ink">Vault Terenkripsi</h2>
        <p className="mt-1 max-w-md text-xs sm:text-sm text-mute">
          Modul Vault terintegrasi dengan enkripsi AES-256-GCM server-side dan audit log akses.
        </p>
      </div>
    </div>
  );
}

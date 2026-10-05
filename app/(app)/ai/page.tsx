import React from "react";
import { Sparkles } from "lucide-react";

export default function AiPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">AI Workspace Assistant</h1>
          <p className="text-xs sm:text-sm text-mute">
            Asisten cerdas yang memahami konteks seluruh project, aplikasi, database, dan task milikmu.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-panel border border-line bg-glass p-12 text-center backdrop-blur-md shadow-soft">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 text-teal mb-4">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-ink">AI Assistant</h2>
        <p className="mt-1 max-w-md text-xs sm:text-sm text-mute">
          Tanyakan relasi data, rangkuman aktivitas, buat task otomatis, atau cari link resource secara instan.
        </p>
      </div>
    </div>
  );
}

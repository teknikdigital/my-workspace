import React from "react";
import { Bookmark } from "lucide-react";

export default function LinksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Personal Links</h1>
        <p className="text-xs sm:text-sm text-mute">
          Tautan dan bookmark situs penting pribadi.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-panel border border-line bg-glass p-12 text-center backdrop-blur-md shadow-soft">
        <Bookmark className="h-10 w-10 text-purple-600 mb-3" />
        <h3 className="text-base font-bold text-ink">Personal Links</h3>
        <p className="mt-1 text-xs text-mute max-w-sm">
          Bookmark link referensi, artikel, dan portal pribadi.
        </p>
      </div>
    </div>
  );
}

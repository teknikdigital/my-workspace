import React from "react";
import { Bell } from "lucide-react";

export default function RemindersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Reminders</h1>
        <p className="text-xs sm:text-sm text-mute">
          Pengingat jadwal, agenda, dan notifikasi otomatis.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-panel border border-line bg-glass p-12 text-center backdrop-blur-md shadow-soft">
        <Bell className="h-10 w-10 text-purple-600 mb-3" />
        <h3 className="text-base font-bold text-ink">Personal Reminders</h3>
        <p className="mt-1 text-xs text-mute max-w-sm">
          Pengingat terjadwal yang terhubung dengan Vercel Cron dan WhatsApp.
        </p>
      </div>
    </div>
  );
}

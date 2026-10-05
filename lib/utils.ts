import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatDateTimeIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "production":
    case "done":
    case "testing":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "development":
    case "in_progress":
      return "bg-teal/10 text-teal dark:text-teal-400 border-teal/20";
    case "urgent":
    case "archived":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    case "high":
    case "planning":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  }
}

export function getStatusLabelIndo(status: string): string {
  const map: Record<string, string> = {
    planning: "Perencanaan",
    development: "Pengembangan",
    testing: "Pengujian",
    production: "Produksi",
    maintenance: "Pemeliharaan",
    archived: "Arsip",
    todo: "Harus Dikerjakan",
    in_progress: "Sedang Dikerjakan",
    done: "Selesai",
    low: "Rendah",
    medium: "Sedang",
    high: "Tinggi",
    urgent: "Mendesak",
    personal: "Pribadi",
    work: "Pekerjaan",
    project: "Project",
  };
  return map[status] || status;
}

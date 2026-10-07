/**
 * Helper waktu (zona WIB, UTC+7) untuk log & ringkasan aktivitas. Murni, diuji di tests/activityPeriod.test.ts.
 */

const WIB_MS = 7 * 3600 * 1000;

/** Tanggal hari ini (YYYY-MM-DD) menurut WIB. */
export function todayWib(now = new Date()): string {
  return new Date(now.getTime() + WIB_MS).toISOString().slice(0, 10);
}

/** "2026-10-06" -> ISO UTC untuk jam 12.00 WIB di tanggal itu (dipakai saat mencatat aktivitas "kemarin"). */
export function noonWibIso(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = Date.parse(`${date}T12:00:00+07:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export type Period = "today" | "yesterday" | "week" | "last7" | "month";

/** Rentang waktu [start, end) dalam ISO UTC untuk periode WIB. Minggu dimulai Senin. */
export function periodRange(period: Period, now = new Date()): { start: string; end: string; label: string } {
  const today = todayWib(now);
  const startOf = (d: string) => new Date(Date.parse(`${d}T00:00:00+07:00`));
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
  const t0 = startOf(today);
  switch (period) {
    case "yesterday":
      return { start: addDays(t0, -1).toISOString(), end: t0.toISOString(), label: "kemarin" };
    case "week": {
      const dow = (new Date(t0.getTime() + WIB_MS).getUTCDay() + 6) % 7; // 0 = Senin
      return { start: addDays(t0, -dow).toISOString(), end: addDays(t0, 1).toISOString(), label: "minggu ini" };
    }
    case "last7":
      return { start: addDays(t0, -6).toISOString(), end: addDays(t0, 1).toISOString(), label: "7 hari terakhir" };
    case "month": {
      const first = startOf(`${today.slice(0, 7)}-01`);
      return { start: first.toISOString(), end: addDays(t0, 1).toISOString(), label: "bulan ini" };
    }
    default:
      return { start: t0.toISOString(), end: addDays(t0, 1).toISOString(), label: "hari ini" };
  }
}

export interface ActivityRow {
  summary: string;
  created_at: string;
  activity_type?: string | null;
  status?: string | null;
  source?: string | null;
  project?: { name?: string | null } | null;
}

/** Kelompokkan aktivitas per project untuk laporan harian/mingguan. */
export function groupByProject(rows: ActivityRow[]) {
  const map = new Map<string, { project: string; count: number; items: { date: string; summary: string; type: string; source: string }[] }>();
  for (const r of rows) {
    const p = r.project?.name || "Tanpa project";
    if (!map.has(p)) map.set(p, { project: p, count: 0, items: [] });
    const g = map.get(p)!;
    g.count++;
    g.items.push({
      date: todayWib(new Date(r.created_at)),
      summary: r.summary,
      type: r.activity_type || "development",
      source: r.source || "manual",
    });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

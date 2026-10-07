import { describe, it, expect } from "vitest";
import { todayWib, noonWibIso, periodRange, groupByProject } from "@/lib/activity/period";

// Rabu, 7 Okt 2026 pukul 01.30 WIB (= 6 Okt 18.30 UTC)
const NOW = new Date("2026-10-06T18:30:00Z");

describe("periode WIB", () => {
  it("tanggal hari ini mengikuti WIB, bukan UTC", () => {
    expect(todayWib(NOW)).toBe("2026-10-07");
  });
  it("jam 12 WIB untuk tanggal tertentu", () => {
    expect(noonWibIso("2026-10-06")).toBe("2026-10-06T05:00:00.000Z");
    expect(noonWibIso("kemarin")).toBeNull();
  });
  it("rentang hari ini, kemarin, minggu ini (Senin), bulan ini", () => {
    expect(periodRange("today", NOW)).toMatchObject({ start: "2026-10-06T17:00:00.000Z", end: "2026-10-07T17:00:00.000Z" });
    expect(periodRange("yesterday", NOW)).toMatchObject({ start: "2026-10-05T17:00:00.000Z", end: "2026-10-06T17:00:00.000Z" });
    // 7 Okt 2026 = Rabu -> Senin 5 Okt
    expect(periodRange("week", NOW).start).toBe("2026-10-04T17:00:00.000Z");
    expect(periodRange("month", NOW).start).toBe("2026-09-30T17:00:00.000Z");
    expect(periodRange("last7", NOW).start).toBe("2026-09-30T17:00:00.000Z");
  });
});

describe("pengelompokan aktivitas", () => {
  it("per project, terbanyak di atas", () => {
    const g = groupByProject([
      { summary: "fix saldo", created_at: "2026-10-07T02:00:00Z", project: { name: "RapiUang" } },
      { summary: "rapat", created_at: "2026-10-07T03:00:00Z", project: null, activity_type: "meeting" },
      { summary: "deploy", created_at: "2026-10-07T04:00:00Z", project: { name: "RapiUang" }, activity_type: "deployment", source: "antigravity" },
    ]);
    expect(g.map((x) => [x.project, x.count])).toEqual([["RapiUang", 2], ["Tanpa project", 1]]);
    expect(g[0].items[1]).toEqual({ date: "2026-10-07", summary: "deploy", type: "deployment", source: "antigravity" });
  });
});

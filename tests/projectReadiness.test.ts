import { describe, it, expect } from "vitest";
import { buildReadiness } from "@/lib/projects/readiness";

describe("buildReadiness", () => {
  it("project baru kosong: semua item kurang", () => {
    const r = buildReadiness({ name: "Rally District" });
    expect(r.score).toBe(0);
    expect(r.missing).toContain("Database");
    expect(r.items.every((i) => i.suggestion)).toBe(true);
  });

  it("menghitung skor, task lewat tenggat, dan resource per role", () => {
    const r = buildReadiness(
      {
        name: "SIAP TPM",
        description: "Sistem informasi availability dan pemeliharaan mesin produksi",
        tech_stack: ["Next.js", "Supabase"],
        applications: [{ name: "SIAP Web" }],
        project_accounts: [{ accounts: { email: "a@b.com", services: { name: "Supabase" } } }],
        project_resources: [
          { role: "database", resources: { name: "supabase-siap" } },
          { role: "repository", resources: { name: "github/siap" } },
        ],
        tasks: [
          { title: "Laporan PDF", status: "todo", due_date: "2026-10-01" },
          { title: "Login", status: "done" },
        ],
        notes: [{}],
      },
      "2026-10-06"
    );
    const get = (k: string) => r.items.find((i) => i.key === k)!;
    expect(get("database").ok).toBe(true);
    expect(get("deployment").ok).toBe(false);
    expect(get("tasks").ok).toBe(false);
    expect(get("tasks").detail).toBe("1 terbuka, 1 lewat tenggat, 1 selesai");
    expect(get("tasks").suggestion).toContain("Laporan PDF");
    expect(get("accounts").detail).toBe("Supabase: a@b.com");
    expect(r.score).toBe(78); // 7 dari 9
    expect(get("database").suggestion).toBeUndefined();
  });
});

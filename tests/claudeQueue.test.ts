import { describe, it, expect } from "vitest";
import { jobButtons, jobCardText, jobResultText, normalizeResult, parseJobCallback } from "@/lib/claudeQueue/format";

const ID = "3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const job = { id: ID, project: "RapiUang", instruction: "Tambah filter kategori di halaman transaksi", mode: "edit", model: "sonnet", status: "draft" as const };

describe("format antrian Claude Code", () => {
  it("kartu & tombol", () => {
    expect(jobCardText(job)).toBe("🛠 **Claude Code · RapiUang** (boleh ubah file, sonnet)\n\nTambah filter kategori di halaman transaksi");
    expect(jobCardText({ ...job, status: "queued" }, "⚠️ agent mati")).toMatch(/⏳ \*\*Antri\*\*[\s\S]*\n⚠️ agent mati$/);
    expect(jobCardText({ ...job, mode: "read", instruction: "x".repeat(2000) }).length).toBeLessThan(1000);
    const b = jobButtons(ID).inline_keyboard[0];
    expect(b.map((x) => x.callback_data)).toEqual([`cq:run:${ID}`, `cq:cancel:${ID}`]);
    expect(Buffer.byteLength(b[1].callback_data)).toBeLessThanOrEqual(64); // batas Telegram
  });
  it("parse callback", () => {
    expect(parseJobCallback(`cq:run:${ID}`)).toEqual({ action: "run", jobId: ID });
    expect(parseJobCallback(`cq:cancel:${ID}`)).toEqual({ action: "cancel", jobId: ID });
    expect(parseJobCallback("cq:run:'; drop table")).toBeNull();
    expect(parseJobCallback("lain")).toBeNull();
    expect(parseJobCallback(undefined)).toBeNull();
  });
  it("pesan hasil", () => {
    const done = jobResultText({ ...job, status: "done", result_summary: "Filter ditambahkan", result_files: ["src/a.tsx", "src/b.ts"], cost_usd: 0.1234 });
    expect(done).toMatch(/✅ \*\*Claude Code selesai · RapiUang\*\*/);
    expect(done).toMatch(/- `src\/a.tsx`/);
    expect(done).toMatch(/\$0\.123/);
    expect(done).toMatch(/git diff/);
    const err = jobResultText({ ...job, status: "error", error: "claude tidak ditemukan" });
    expect(err).toMatch(/❌ .*gagal/);
    expect(err).toMatch(/Penyebab: claude tidak ditemukan/);
    const many = jobResultText({ ...job, status: "done", result_files: Array.from({ length: 20 }, (_, i) => `f${i}`) });
    expect(many).toMatch(/… 8 lainnya/);
  });
  it("validasi laporan agent", () => {
    expect(normalizeResult({ status: "hack", files: "x", costUsd: "1" })).toEqual({ status: "error", summary: null, files: [], error: null, costUsd: null });
    expect(normalizeResult({ status: "done", summary: "ok", files: ["a"], costUsd: 0.5 }).costUsd).toBe(0.5);
  });
});

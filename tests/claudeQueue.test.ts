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
  it("jawaban lengkap Claude diteruskan (dipotong bila sangat panjang)", () => {
    const t = jobResultText({ ...job, mode: "read", status: "done", result_summary: "ringkas" }, "## Project yang pakai Supabase\n- RapiUang\n- My Workspace");
    expect(t).toMatch(/## Project yang pakai Supabase\n- RapiUang/);
    expect(t).not.toMatch(/ringkas/); // jawaban lengkap menggantikan ringkasan 1 baris
    const long = jobResultText({ ...job, status: "done" }, "x".repeat(20000));
    expect(long.length).toBeLessThan(12300);
    expect(long).toMatch(/jawaban dipotong/);
    expect(normalizeResult({ status: "done", answer: "a".repeat(20000) }).answer!.length).toBe(12001);
  });
  it("kartu lanjutan & validasi ID sesi", () => {
    expect(jobCardText({ ...job, resume_session_id: "0f5a9c7e-1111" })).toMatch(/↪️ Melanjutkan sesi Claude sebelumnya/);
    expect(jobCardText(job)).not.toMatch(/Melanjutkan/);
    expect(normalizeResult({ status: "done", sessionId: "0f5a9c7e-1111-4222" }).sessionId).toBe("0f5a9c7e-1111-4222");
    expect(normalizeResult({ status: "done", sessionId: "; rm -rf /" }).sessionId).toBeNull();
  });
  it("validasi laporan agent", () => {
    expect(normalizeResult({ status: "hack", files: "x", costUsd: "1" })).toEqual({ status: "error", summary: null, files: [], error: null, costUsd: null, answer: null, sessionId: null });
    expect(normalizeResult({ status: "done", summary: "ok", files: ["a"], costUsd: 0.5 }).costUsd).toBe(0.5);
  });
});

import { queueTtlHours, jobStartedText, jobCardText as cardText } from "@/lib/claudeQueue/format";

describe("antrian saat laptop mati", () => {
  it("batas antri default 24 jam, bisa diatur 1 s.d. 72", () => {
    expect(queueTtlHours(undefined)).toBe(24);
    expect(queueTtlHours("")).toBe(24);
    expect(queueTtlHours("abc")).toBe(24);
    expect(queueTtlHours("0")).toBe(24);
    expect(queueTtlHours("8")).toBe(8);
    expect(queueTtlHours("500")).toBe(72);
  });
  it("kartu kedaluwarsa menyebut 24 jam", () => {
    const t = cardText({ id: "x", project: "P", instruction: "i", mode: "read", model: "sonnet", status: "expired" } as any);
    expect(t).toContain("24 jam");
  });
  it("pesan mulai menyebut lama menunggu", () => {
    const now = Date.parse("2026-10-09T07:00:00Z");
    expect(jobStartedText({ project: "Rally District", queued_at: "2026-10-08T22:00:00Z" }, now)).toBe(
      "▶️ Laptop online. Claude Code mulai mengerjakan **Rally District** (menunggu 9 jam)."
    );
    expect(jobStartedText({ project: "P", queued_at: "2026-10-09T06:50:00Z" }, now)).toContain("(menunggu 10 menit)");
    expect(jobStartedText({ project: "P" }, now)).toBe("▶️ Laptop online. Claude Code mulai mengerjakan **P**.");
  });
});

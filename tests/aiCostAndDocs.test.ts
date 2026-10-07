import { describe, it, expect } from "vitest";
import { costUsd, toIdr, startOfTodayWib, priceFor } from "@/lib/ai/usage";
import {
  buildFileBlock,
  compactHistory,
  compactFileBlocks,
  hasFileBlock,
  limitHistory,
  formatFactsNote,
  COMPACT_NOTE,
} from "@/lib/ai/fileBlocks";
import { finalize, fileKind, canExtract, MAX_CHARS_PER_FILE } from "@/lib/files/extractText";

describe("biaya AI", () => {
  it("menghitung biaya gpt-4o-mini dengan cache", () => {
    // 8.000 input (2.000 cached) + 300 output
    const usd = costUsd("gpt-4o-mini", { input: 8000, cached: 2000, output: 300 });
    expect(usd).toBeCloseTo((6000 * 0.15 + 2000 * 0.075 + 300 * 0.6) / 1e6, 10);
    expect(toIdr(usd)).toBe(Math.round(usd * 16500));
  });
  it("model tidak dikenal memakai tarif gpt-4o-mini", () => {
    expect(priceFor("model-baru")).toEqual(priceFor("gpt-4o-mini"));
    expect(priceFor("gpt-4o-2024-08-06").input).toBe(2.5);
    expect(priceFor("gpt-4o-mini-2024-07-18").input).toBe(0.15);
  });
  it("awal hari dihitung dalam WIB", () => {
    // 6 Okt 2026 02:00 WIB = 5 Okt 19:00 UTC -> awal hari 5 Okt 17:00 UTC
    expect(startOfTodayWib(new Date("2026-10-05T19:00:00Z"))).toBe("2026-10-05T17:00:00.000Z");
    expect(startOfTodayWib(new Date("2026-10-06T16:59:00Z"))).toBe("2026-10-05T17:00:00.000Z");
  });
});

describe("blok isi file", () => {
  const block = buildFileBlock({ name: "NIB.pdf", project: "Rally District", path: "D:\\Rally District\\_Masuk\\NIB.pdf" }, "NIB: 0812240099731");
  it("format & ringkas", () => {
    expect(hasFileBlock(block)).toBe(true);
    const c = compactFileBlocks(`Simpan ini\n\n${block}`);
    expect(c).toContain("[ISI FILE: NIB.pdf | project: Rally District");
    expect(c).toContain(COMPACT_NOTE);
    expect(c).not.toContain("0812240099731");
  });
  it("hanya pesan pengguna terakhir yang tetap utuh", () => {
    const h = compactHistory([
      { role: "user", content: block },
      { role: "assistant", content: "Disimpan" },
      { role: "user", content: `lagi\n${block}` },
    ]);
    expect(h[0].content).not.toContain("0812240099731");
    expect(h[2].content).toContain("0812240099731");
  });
  it("limitHistory mulai dari pesan pengguna", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: String(i) }));
    const l = limitHistory(msgs, 12);
    expect(l[0].role).toBe("user");
    expect(l.length).toBeLessThanOrEqual(12);
    expect(l[l.length - 1].content).toBe("19");
  });
  it("catatan fakta dokumen", () => {
    const n = formatFactsNote({
      file_name: "NIB.pdf",
      file_path: "D:\\Rally District\\_Masuk\\NIB.pdf",
      summary: "NIB PT Rally Distrik Nusantara.",
      facts: [{ label: "NIB", value: "0812240099731" }, { label: "", value: "x" }],
    });
    expect(n).toContain("- NIB: 0812240099731");
    expect(n).not.toContain("- : x");
    expect(n).toContain("Ringkasan: NIB PT Rally Distrik Nusantara.");
  });
});

describe("ekstraksi (bagian murni)", () => {
  it("jenis file", () => {
    expect(fileKind("NIB.PDF")).toBe("pdf");
    expect(fileKind("a.xlsx")).toBe("sheet");
    expect(fileKind("foto.jpg")).toBe("image");
    expect(canExtract("foto.jpg")).toBe(false);
    expect(canExtract("catatan.md")).toBe(true);
  });
  it("teks kosong = kemungkinan scan, teks panjang dipotong", () => {
    expect(finalize("  \n ", "pdf").ok).toBe(false);
    const r = finalize("a".repeat(MAX_CHARS_PER_FILE + 500), "text");
    expect(r.ok && r.truncated).toBe(true);
    if (r.ok) expect(r.text).toContain("terpotong, 500 karakter");
  });
});

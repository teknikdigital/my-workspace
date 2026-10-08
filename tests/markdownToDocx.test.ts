import { describe, it, expect } from "vitest";
import { markdownToDocx, columnWidths, safeFileBase } from "@/lib/documents/markdownToDocx";

async function docText(buf: Buffer) {
  const mammoth: any = await import("mammoth");
  const m = mammoth.default || mammoth;
  return { raw: (await m.extractRawText({ buffer: buf })).value as string, html: (await m.convertToHtml({ buffer: buf })).value as string };
}

describe("markdownToDocx", () => {
  it("judul, heading, tebal/miring, daftar, tabel, kode", async () => {
    const md = "# Notulen Rapat\n\n## Keputusan\n1. **FAT** tanggal 20 Okt\n2. *SAT* menyusul\n\n- poin A\n  - sub B\n\n| No | Tindak lanjut |\n|---|---|\n| 1 | Kirim URS |\n\n```\nkode <x>\n```";
    const buf = await markdownToDocx(md, { title: "Notulen Rapat", subtitle: "Dibuat 08/10/2026" });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const { raw, html } = await docText(buf);
    expect(raw.match(/Notulen Rapat/g)).toHaveLength(1); // heading pertama = judul, tidak diulang
    expect(html).toMatch(/<h2>Keputusan<\/h2>|<h1>Keputusan<\/h1>/);
    expect(html).toMatch(/<strong>FAT<\/strong>/);
    expect(html).toMatch(/<em>SAT<\/em>/);
    expect(html).toMatch(/<table>[\s\S]*Kirim URS[\s\S]*<\/table>/);
    expect(raw).toMatch(/kode <x>/);
    expect(raw).toMatch(/Dibuat 08\/10\/2026/);
  });
  it("lebar kolom & nama file", () => {
    const w = columnWidths([["No", "Tindak lanjut panjang sekali"], ["1", "Kirim URS ke vendor"]], 2);
    expect(w[0]).toBeLessThan(w[1]);
    expect(w.reduce((a, b) => a + b, 0)).toBe(9070);
    expect(safeFileBase("TOR: Rapat / Isolator 2026?")).toBe("TOR-Rapat-Isolator-2026");
    expect(safeFileBase("???")).toBe("dokumen");
  });
});

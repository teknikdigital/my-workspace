import { describe, it, expect } from "vitest";
import { pickDocument, queryWords, splitOriginalPath, plainTitle } from "@/lib/documents/findDocument";
import { inboxRoots, isInside, readLocalOriginal } from "@/lib/files/localOriginal";
import fs from "fs";
import os from "os";
import path from "path";

const rows = [
  { title: "📄 nib_rally_district.pdf", tags: ["dokumen"], content: "Fakta penting:\n- NIB: 1503220029113\n\nFile: D:\\Rally District\\_Masuk\\nib_rally_district.pdf", project: { name: "Rally District" }, updated_at: "2026-10-07" },
  { title: "📚 nib_rally_district.pdf", tags: ["dokumen-lengkap"], content: "PEMERINTAH REPUBLIK INDONESIA\n\n---\nFile asli: D:\\Rally District\\_Masuk\\nib_rally_district.pdf", project: { name: "Rally District" }, updated_at: "2026-10-07" },
  { title: "📚 HANDOFF.md", tags: ["dokumen-lengkap"], content: "Status", project: { name: "RapiUang" }, updated_at: "2026-10-08" },
  { title: "📝 TOR Rapat Koordinasi Isolator", tags: ["dokumen-dibuat"], content: "## Latar", project: null, updated_at: "2026-10-08" },
];

describe("pencarian dokumen per kata", () => {
  it("'NIB Rally District pdf' -> 📚 nib_rally_district.pdf (teks utuh diutamakan)", () => {
    const p = pickDocument(rows, "kirim NIB Rally District pdf");
    expect(p!.best.title).toBe("📚 nib_rally_district.pdf");
    expect(p!.others[0].title).toBe("📄 nib_rally_district.pdf");
  });
  it("judul sebagian & nama project", () => {
    expect(pickDocument(rows, "TOR isolator")!.best.title).toBe("📝 TOR Rapat Koordinasi Isolator");
    expect(pickDocument(rows, "handoff rapiuang")!.best.title).toBe("📚 HANDOFF.md");
    expect(pickDocument(rows, "kontrak vendor")).toBeNull();
    expect(pickDocument(rows, "dokumen pdf")).toBeNull(); // hanya kata umum
  });
  it("kata kunci & trailer lokasi file", () => {
    expect(queryWords("Kirim dokumen NIB Rally District PDF dong")).toEqual(["nib", "rally", "district"]);
    expect(splitOriginalPath(rows[1].content)).toEqual({ text: "PEMERINTAH REPUBLIK INDONESIA", path: "D:\\Rally District\\_Masuk\\nib_rally_district.pdf" });
    expect(splitOriginalPath("isi\n\nFile: nib.pdf")).toEqual({ text: "isi", path: null });
    expect(splitOriginalPath("tanpa trailer").path).toBeNull();
    expect(plainTitle("📚 a.pdf")).toBe("a.pdf");
  });
});

describe("file asli hanya dari folder _Masuk", () => {
  it("isInside (Windows & posix, aman dari ..)", () => {
    expect(isInside("D:\\Rally District\\_Masuk\\nib.pdf", "D:\\Rally District\\_Masuk")).toBe(true);
    expect(isInside("d:\\rally district\\_masuk\\sub\\a.pdf", "D:\\Rally District\\_Masuk\\")).toBe(true);
    expect(isInside("D:\\Rally District\\_Masuk\\..\\.env", "D:\\Rally District\\_Masuk")).toBe(false);
    expect(isInside("D:\\Rally District\\_MasukLain\\a.pdf", "D:\\Rally District\\_Masuk")).toBe(false);
    expect(isInside("D:\\Rally District\\_Masuk", "D:\\Rally District\\_Masuk")).toBe(false);
    expect(isInside("/home/x/_Masuk/a.pdf", "/home/x/_Masuk")).toBe(true);
  });
  it("inboxRoots dari apps.json", () => {
    expect(inboxRoots({ apps: [{ folder: "D:\\Rally District", processes: [] }, { processes: [{ cwd: "D:\\X" }] }] })).toEqual([
      "D:\\Rally District\\_Masuk",
      "D:\\X\\_Masuk",
    ]);
  });
  it("membaca file asli; menolak di luar inbox, ekstensi terlarang, file hilang", async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "mw-"));
    fs.mkdirSync(path.join(base, "_Masuk"));
    fs.writeFileSync(path.join(base, "_Masuk", "nib.pdf"), "%PDF-1.4 isi");
    fs.writeFileSync(path.join(base, "_Masuk", "kunci.env"), "RAHASIA=1");
    fs.writeFileSync(path.join(base, "rahasia.pdf"), "x");
    fs.symlinkSync(path.join(base, "rahasia.pdf"), path.join(base, "_Masuk", "tautan.pdf"));
    const cfg = { apps: [{ id: "rally", folder: base, processes: [{ cwd: base }] }] };
    const ok = await readLocalOriginal(path.join(base, "_Masuk", "nib.pdf"), cfg);
    expect(ok).toMatchObject({ ok: true, name: "nib.pdf" });
    expect((ok as any).data.toString()).toBe("%PDF-1.4 isi");
    expect(await readLocalOriginal(path.join(base, "rahasia.pdf"), cfg)).toMatchObject({ ok: false, reason: expect.stringMatching(/_Masuk/) });
    expect(await readLocalOriginal(path.join(base, "_Masuk", "kunci.env"), cfg)).toMatchObject({ ok: false });
    expect(await readLocalOriginal(path.join(base, "_Masuk", "tautan.pdf"), cfg)).toMatchObject({ ok: false }); // symlink keluar inbox
    expect(await readLocalOriginal(path.join(base, "_Masuk", "hilang.pdf"), cfg)).toMatchObject({ ok: false, reason: expect.stringMatching(/tidak ditemukan/) });
    expect(await readLocalOriginal("D:\\Rally District\\_Masuk\\nib.pdf", { apps: [{ folder: "D:\\Rally District", processes: [] }] })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/laptop/),
    });
  });
});

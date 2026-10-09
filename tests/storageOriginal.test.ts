import { describe, it, expect } from "vitest";
import { canStore, storageSafeName, storagePathOf, displayNameOf, STORAGE_PREFIX } from "@/lib/files/storageOriginal";
import { splitOriginalPath } from "@/lib/documents/findDocument";

describe("file asli di Storage", () => {
  it("jenis yang disimpan", () => {
    for (const f of ["a.pdf", "b.DOCX", "c.xlsx", "d.pptx", "e.jpg", "f.png", "g.zip"]) expect(canStore(f)).toBe(true);
    for (const f of ["setup.exe", "x.js", "tanpa-ekstensi"]) expect(canStore(f)).toBe(false);
  });
  it("nama aman untuk path", () => {
    expect(storageSafeName("DOC-20261009-WA0000.pdf")).toBe("DOC-20261009-WA0000.pdf");
    expect(storageSafeName("Panduan My Workspace (final).pdf")).toBe("Panduan_My_Workspace_final.pdf");
    expect(storageSafeName("../../etc/passwd.pdf")).toBe("etc_passwd.pdf");
  });
  it("rujukan Storage: hanya awalan resmi, tanpa ..", () => {
    expect(storagePathOf(`${STORAGE_PREFIX}u1/telegram/17_a.pdf`)).toBe("u1/telegram/17_a.pdf");
    expect(storagePathOf(`${STORAGE_PREFIX}u1/../u2/a.pdf`)).toBeNull();
    expect(storagePathOf("D:\\\\x\\\\a.pdf")).toBeNull();
    expect(displayNameOf("u1/telegram/1791000000000_NIB_Rally.pdf")).toBe("NIB_Rally.pdf");
  });
  it("trailer 'File asli: storage:...' dikenali sebagai lokasi file asli", () => {
    expect(splitOriginalPath("isi\n\n---\nFile asli: storage:documents/u1/telegram/17_a.pdf")).toEqual({ text: "isi", path: "storage:documents/u1/telegram/17_a.pdf" });
  });
});

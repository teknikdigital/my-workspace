import { describe, it, expect } from "vitest";
import { extractContacts, normalizePhone, excerptAround } from "@/lib/ai/contacts";

describe("extractContacts", () => {
  const rows = [
    { type: "catatan", title: "Akun Google", text: "Email kantor: Teknikdigital104@gmail.com\nCadangan landakh6@gmail.com." },
    { type: "catatan", title: "Daftar akun", text: "fotobersamaarinadya@gmail.com, k3mc2025@gmail.com, teknikdigital104@gmail.com" },
    { type: "akun", title: "Supabase", text: "julianpandanu@gmail.com" },
    { type: "vault", title: "Password Gmail", text: "Password Gmail julianpandanu@gmail.com" },
    { type: "catatan", title: "Kontak", text: "HP: 0819-2955-3270, WA +62 819 9048 6962, kantor 022-123456" },
  ];
  it("semua email unik, huruf kecil, beserta sumbernya; titik akhir kalimat dibuang", () => {
    const r = extractContacts(rows);
    expect(r.map((c) => c.value)).toEqual([
      "fotobersamaarinadya@gmail.com",
      "julianpandanu@gmail.com",
      "k3mc2025@gmail.com",
      "landakh6@gmail.com",
      "teknikdigital104@gmail.com",
    ]);
    expect(r.find((c) => c.value === "teknikdigital104@gmail.com")!.sources).toEqual(["catatan: Akun Google", "catatan: Daftar akun"]);
    expect(r.find((c) => c.value === "julianpandanu@gmail.com")!.sources).toEqual(["akun: Supabase", "vault: Password Gmail"]);
  });
  it("nomor HP Indonesia dinormalkan; nomor kantor non-HP diabaikan", () => {
    expect(extractContacts(rows, "phone").map((c) => c.value)).toEqual(["081929553270", "081990486962"]);
    expect(normalizePhone("+62 812-3456-7890")).toBe("081234567890");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("banyak catatan: tidak ada batas 5", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ type: "catatan", title: `C${i}`, text: `user${i}@contoh.id` }));
    expect(extractContacts(many)).toHaveLength(40);
  });
});

describe("excerptAround", () => {
  it("potongan di sekitar kata kunci, bukan 80 karakter pertama", () => {
    const body = `${"pembuka ".repeat(60)}akun cadangan: rahasia.backup@gmail.com ${"penutup ".repeat(60)}`;
    const ex = excerptAround(body, "cadangan");
    expect(ex[0]).toContain("rahasia.backup@gmail.com");
    expect(ex[0].startsWith("…")).toBe(true);
  });
  it("tanpa kecocokan: awal teks", () => {
    expect(excerptAround("isi singkat", "xyz")).toEqual(["isi singkat"]);
  });
});

import { describe, it, expect } from "vitest";
import { findSecrets, guardMessages, guessVaultLabel, MASK_TEXT } from "@/lib/ai/secretGuard";

const values = (t: string) => findSecrets(t).map((s) => s.value);

describe("findSecrets", () => {
  it("kasus nyata: password setelah kata pengisi", () => {
    const t =
      "rally district supabase nya menggunakan akun julianpandanu@gmail.com dimana password emailnya @Arijulian121eDoy039";
    expect(values(t)).toEqual(["@Arijulian121eDoy039"]);
  });

  it("berbagai format kata kunci", () => {
    expect(values("password: rahasia")).toEqual(["rahasia"]);
    expect(values("pass gmail saya = Ab12cd!!")).toEqual(["Ab12cd!!"]);
    expect(values("kata sandi nya adalah 'kopi pagi 77'")).toEqual(["kopi pagi 77"]);
    expect(values("PIN ATM 123456")).toEqual(["123456"]);
    expect(values("api key nya sk-proj-abcdefghijklmnopqrstuvwx")).toEqual(["sk-proj-abcdefghijklmnopqrstuvwx"]);
  });

  it("format kunci khas tanpa kata kunci", () => {
    expect(values("ini ghp_abcdefghijklmnopqrstuvwxyz0123456789 ya")).toHaveLength(1);
    expect(values("AKIAABCDEFGHIJKLMNOP")).toHaveLength(1);
    expect(values("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.abcdefghijklmnop")).toHaveLength(1);
  });

  it("penanda eksplisit ||...||", () => {
    expect(values("simpan ||rahasia biasa|| untuk wifi kantor")).toEqual(["rahasia biasa"]);
  });

  it("tidak salah tangkap kalimat biasa", () => {
    expect(values("saya lupa password gmail saya kemarin")).toEqual([]);
    expect(values("buat fitur reset password di aplikasi")).toEqual([]);
    expect(values("kirim email ke julianpandanu@gmail.com")).toEqual([]);
    expect(values("token nya sudah expired")).toEqual([]);
    expect(values("password minimal 8 karakter dan ganti tiap 90 hari")).toEqual([]);
    expect(values("buat halaman lupa kata sandi untuk user baru")).toEqual([]);
  });
});

describe("guardMessages", () => {
  it("AI hanya melihat placeholder, browser melihat versi tersamar", () => {
    const msgs = [
      { role: "assistant", content: "Halo" },
      { role: "user", content: "akun julianpandanu@gmail.com password nya @Arijulian121eDoy039" },
    ];
    const g = guardMessages(msgs);
    expect(g.safeMessages[1].content).toBe("akun julianpandanu@gmail.com password nya [[RAHASIA_1]]");
    expect(g.maskedMessages[1].content).toContain(MASK_TEXT);
    expect(JSON.stringify(g.safeMessages)).not.toContain("Arijulian");
    expect(JSON.stringify(g.maskedMessages)).not.toContain("Arijulian");
    expect(g.secrets[0]).toMatchObject({ placeholder: "[[RAHASIA_1]]", value: "@Arijulian121eDoy039", email: "julianpandanu@gmail.com" });
    expect(guessVaultLabel(g.secrets[0])).toBe("Password Google julianpandanu@gmail.com");
  });

  it("riwayat yang sudah disamarkan tidak tersimpan ulang", () => {
    const first = guardMessages([{ role: "user", content: "password gmail saya @Arijulian121eDoy039" }]);
    const again = guardMessages([...first.maskedMessages, { role: "user", content: "oke lanjut" }]);
    expect(again.secrets).toHaveLength(0);
    expect(guardMessages([{ role: "user", content: "pin nya [[RAHASIA_1]]" }]).secrets).toHaveLength(0);
  });

  it("penomoran berurutan lintas pesan, pesan assistant tidak diubah", () => {
    const g = guardMessages([
      { role: "user", content: "pin 1234" },
      { role: "assistant", content: "password: bukan-urusan-filter" },
      { role: "user", content: "token = abcd1234efgh" },
    ]);
    expect(g.secrets.map((s) => s.placeholder)).toEqual(["[[RAHASIA_1]]", "[[RAHASIA_2]]"]);
    expect(g.safeMessages[1].content).toBe("password: bukan-urusan-filter");
  });
});

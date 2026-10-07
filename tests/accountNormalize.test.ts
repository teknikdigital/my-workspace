import { describe, it, expect } from "vitest";
import {
  resolveServiceName,
  matchByName,
  mergeTags,
  looksLikeSecret,
  escapeLike,
  slugify,
} from "@/lib/accounts/normalize";

describe("resolveServiceName", () => {
  it("menyeragamkan alias umum", () => {
    expect(resolveServiceName("gmail")).toEqual({ name: "Google", slug: "google", category: "productivity" });
    expect(resolveServiceName(" GitHub ").name).toBe("GitHub");
    expect(resolveServiceName("ChatGPT").name).toBe("OpenAI");
    expect(resolveServiceName("google cloud").slug).toBe("google-cloud");
  });
  it("service tidak dikenal tetap diterima", () => {
    expect(resolveServiceName("hostinger")).toEqual({ name: "Hostinger", slug: "hostinger", category: "other" });
  });
});

describe("matchByName", () => {
  const rows = [
    { id: "1", name: "SIAP TPM", slug: "siap-tpm" },
    { id: "2", name: "Rapiuang", slug: "rapiuang" },
    { id: "3", name: "OEE Tahap 2", slug: "oee-tahap-2" },
    { id: "4", name: "OEE Tahap 3", slug: "oee-tahap-3" },
  ];
  it("cocok persis, tidak peka huruf besar", () => {
    expect(matchByName("siap tpm", rows)).toEqual({ kind: "match", row: rows[0] });
    expect(matchByName("rapiuang", rows)).toEqual({ kind: "match", row: rows[1] });
  });
  it("sebagian kata yang unik tetap cocok", () => {
    expect(matchByName("tahap 3", rows)).toEqual({ kind: "match", row: rows[3] });
  });
  it("ambigu bila lebih dari satu", () => {
    const r = matchByName("OEE", rows);
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") expect(r.options.map((o) => o.id)).toEqual(["3", "4"]);
  });
  it("tidak ditemukan", () => {
    expect(matchByName("Portal Teknik", rows).kind).toBe("none");
    expect(matchByName("  ", rows).kind).toBe("none");
  });
});

describe("helper lain", () => {
  it("mergeTags tanpa duplikat", () => {
    expect(mergeTags(["dev", "Billing"], ["billing", "personal", " "])).toEqual(["dev", "Billing", "personal"]);
  });
  it("looksLikeSecret mendeteksi password/API key", () => {
    expect(looksLikeSecret("password: rahasia123")).toBe(true);
    expect(looksLikeSecret("kata sandi abc")).toBe(true);
    expect(looksLikeSecret("key sk-abcdefghijklmnop")).toBe(true);
    expect(looksLikeSecret("akun untuk deploy Vercel")).toBe(false);
    expect(looksLikeSecret(undefined)).toBe(false);
  });
  it("escapeLike & slugify", () => {
    expect(escapeLike("50%_off")).toBe("50\\%\\_off");
    expect(slugify("Sparpart System 2!")).toBe("sparpart-system-2");
  });
});

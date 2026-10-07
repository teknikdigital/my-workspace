import { describe, it, expect } from "vitest";
import { normalizeUrl, guessCategory, roleFromCategory, deriveResourceName, guessAppType } from "@/lib/resources/classify";

describe("resource", () => {
  it("normalizeUrl", () => {
    expect(normalizeUrl("github.com/julian/rally-district")).toBe("https://github.com/julian/rally-district");
    expect(normalizeUrl("https://abcd1234.supabase.co/")).toBe("https://abcd1234.supabase.co");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("bukan url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
  it("kategori & peran dari URL", () => {
    const cases: [string, string, string][] = [
      ["https://github.com/julian/rally", "github", "repository"],
      ["https://abcd1234.supabase.co", "supabase", "database"],
      ["https://supabase.com/dashboard/project/abcd1234", "supabase", "database"],
      ["https://rallydistrict.vercel.app", "vercel", "deployment"],
      ["https://docs.google.com/spreadsheets/d/x", "google_sheet", "documentation"],
      ["https://rallydistrict.id", "other", "other"],
    ];
    for (const [u, c, r] of cases) {
      expect(guessCategory(u)).toBe(c);
      expect(roleFromCategory(guessCategory(u))).toBe(r);
    }
    expect(roleFromCategory(guessCategory("https://rallydistrict.id", "deployment"))).toBe("deployment");
  });
  it("nama tampilan", () => {
    expect(deriveResourceName("https://github.com/julian/rally", "github")).toBe("GitHub: julian/rally");
    expect(deriveResourceName("https://abcd1234.supabase.co", "supabase")).toBe("Supabase: abcd1234");
    expect(deriveResourceName("https://supabase.com/dashboard/project/abcd1234", "supabase")).toBe("Supabase: abcd1234");
    expect(deriveResourceName(null, "other", "Server kantor")).toBe("Server kantor");
  });
  it("jenis aplikasi", () => {
    expect(guessAppType("Next.js 16")).toBe("nextjs");
    expect(guessAppType("Google Apps Script")).toBe("apps_script");
    expect(guessAppType("Express API")).toBe("backend");
    expect(guessAppType("apa saja", "pwa")).toBe("pwa");
    expect(guessAppType(null)).toBe("other");
  });
});

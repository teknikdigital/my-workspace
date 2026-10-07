import { describe, it, expect } from "vitest";
import { splitSections, pickSections, tableOfContents } from "@/lib/documents/sections";

const DOC = `# RapiUang: Dokumen Serah Terima

## BAGIAN F. API ENDPOINT
- POST /auth/login
- GET /health

## BAGIAN G. DEPLOYMENT & HOSTING

### G1. Lingkungan produksi
Provider Rumahweb cPanel, domain rapiuang.my.id

### G2. Langkah update rilis
1. node scripts/build-deploy.mjs
\`\`\`
# ini bukan judul (di dalam blok kode)
\`\`\`

## BAGIAN H. ATURAN KERJA (WAJIB)
Jangan pernah menjalankan final_setup.sql
`;

describe("dokumen per bagian", () => {
  it("memecah per judul dengan jalur induk, mengabaikan # di blok kode", () => {
    const toc = tableOfContents(splitSections(DOC));
    expect(toc).toEqual([
      "RapiUang: Dokumen Serah Terima > BAGIAN F. API ENDPOINT",
      "RapiUang: Dokumen Serah Terima > BAGIAN G. DEPLOYMENT & HOSTING > G1. Lingkungan produksi",
      "RapiUang: Dokumen Serah Terima > BAGIAN G. DEPLOYMENT & HOSTING > G2. Langkah update rilis",
      "RapiUang: Dokumen Serah Terima > BAGIAN H. ATURAN KERJA (WAJIB)",
    ]);
  });

  it("memilih bagian relevan", () => {
    const s = splitSections(DOC);
    const deploy = pickSections(s, "bagaimana cara deploy rilis baru?").map((x) => x.heading);
    expect(deploy.some((h) => h.includes("G2. Langkah update rilis"))).toBe(true);
    expect(deploy.some((h) => h.includes("API ENDPOINT"))).toBe(false);
    expect(pickSections(s, "domain dan hosting apa?").map((x) => x.heading)).toContain(
      "RapiUang: Dokumen Serah Terima > BAGIAN G. DEPLOYMENT & HOSTING > G1. Lingkungan produksi"
    );
    expect(pickSections(s, "file sql apa yang tidak boleh dijalankan final_setup.sql")[0].heading).toContain("ATURAN KERJA");
    expect(pickSections(s, "")).toEqual([]);
  });

  it("menghormati batas karakter", () => {
    const big = Array.from({ length: 10 }, (_, i) => `## Bagian ${i}\ndeploy ${"x".repeat(2000)}`).join("\n");
    const picked = pickSections(splitSections(big), "deploy", 5000);
    expect(picked.length).toBe(2);
  });
});

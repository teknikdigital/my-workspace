import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, parseMarkdown } from "@/components/ui/Markdown";

const html = (t: string) => renderToStaticMarkup(<Markdown text={t} />);

// Contoh nyata jawaban AI (NIB + laporan kesiapan)
const SAMPLE = `Fakta dari dokumen NIB telah berhasil disimpan ke project **Rally District**. Berikut faktanya:
- NIB: 1234567890123
- Email: rallydistrictbdg@gmail.com

### Kesiapan Project Rally District
Project ini memiliki skor kesiapan **33%**:
1. **Deskripsi & tujuan project**: Belum ada.
   - **Saran**: Tulis deskripsi singkat.
2. **Repository kode**: Belum terhubung.
   - **Saran**: Hubungkan resource repository (GitHub/GitLab).

Apakah Anda ingin membuat task?`;

describe("Markdown", () => {
  it("struktur blok contoh nyata", () => {
    const b = parseMarkdown(SAMPLE);
    expect(b.map((x) => x.type)).toEqual(["p", "ul", "h", "p", "ol", "p"]);
    const ol = b[4] as any;
    expect(ol.items).toHaveLength(2);
    expect(ol.items[0].children[0].type).toBe("ul"); // sub-butir "Saran"
  });

  it("tebal, judul, daftar bertingkat ter-render", () => {
    const h = html(SAMPLE);
    expect(h).toContain('<strong class="font-bold text-ink">Rally District</strong>');
    expect(h).toContain("<strong class=\"font-bold text-ink\">33%</strong>");
    expect(h).toContain("Kesiapan Project Rally District</p>");
    expect(h).toMatch(/<ol start="1"[^>]*>/);
    expect(h).not.toContain("**");
    expect(h).not.toContain("###");
  });

  it("aman: HTML mentah tidak dieksekusi, tautan hanya http(s)", () => {
    const h = html('<img src=x onerror=alert(1)> [klik](javascript:alert(1)) [ok](https://vercel.com)');
    expect(h).toContain("&lt;img");
    expect(h).not.toContain('href="javascript');
    expect(h).toContain('href="https://vercel.com"');
  });

  it("kode inline & blok", () => {
    const h = html("Jalankan `npm run dev`\n\n```\nnpm install\n```");
    expect(h).toContain("<code");
    expect(h).toContain("npm install");
  });
});

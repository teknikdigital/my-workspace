/**
 * Ekstraksi email / nomor telepon dari teks bebas (fungsi murni, diuji di tests/contacts.test.ts).
 */

export type ContactKind = "email" | "phone";
export interface ContactSourceRow {
  type: string;
  title: string;
  text: string;
}
export interface FoundContact {
  value: string;
  sources: string[]; // "catatan: Akun Google kantor"
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/g;
// Nomor Indonesia: +62 / 62 / 0 diikuti 8xx (HP) atau kode area; boleh dipisah spasi/titik/strip
const PHONE_RE = /(?:\+62|62|0)[\s.-]?8\d(?:[\s.-]?\d){6,11}/g;

/** Normalisasi nomor ke format 08xxxxxxxxxx. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = `0${d.slice(2)}`;
  if (!/^08\d{8,11}$/.test(d)) return null;
  return d;
}

export function extractContacts(rows: ContactSourceRow[], kind: ContactKind = "email", maxSourcesPerContact = 5): FoundContact[] {
  const map = new Map<string, FoundContact>();
  for (const row of rows) {
    const text = String(row.text || "");
    const matches = kind === "email" ? text.match(EMAIL_RE) || [] : text.match(PHONE_RE) || [];
    const seenInRow = new Set<string>();
    for (const m of matches) {
      const value = kind === "email" ? m.replace(/[.]+$/, "").toLowerCase() : normalizePhone(m);
      if (!value || seenInRow.has(value)) continue;
      seenInRow.add(value);
      const src = `${row.type}: ${String(row.title || "").slice(0, 80)}`;
      const cur = map.get(value);
      if (cur) {
        if (cur.sources.length < maxSourcesPerContact && !cur.sources.includes(src)) cur.sources.push(src);
      } else map.set(value, { value, sources: [src] });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.value.localeCompare(b.value));
}

/** Potongan teks di sekitar kata kunci (maks `max` potongan @ `width` karakter), untuk hasil pencarian catatan. */
export function excerptAround(body: string, query: string, width = 240, max = 3): string[] {
  const text = String(body || "");
  const words = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits: number[] = [];
  for (const w of words) {
    let i = lower.indexOf(w);
    while (i >= 0 && hits.length < 50) {
      hits.push(i);
      i = lower.indexOf(w, i + w.length);
    }
  }
  if (!hits.length) return [text.slice(0, width).trim()];
  hits.sort((a, b) => a - b);
  const out: string[] = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (out.length >= max) break;
    const start = Math.max(0, h - Math.floor(width / 3));
    if (start < lastEnd) continue;
    const end = Math.min(text.length, start + width);
    out.push(`${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`);
    lastEnd = end;
  }
  return out;
}

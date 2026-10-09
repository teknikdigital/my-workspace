/**
 * Pencarian dokumen tersimpan berdasarkan kata (murni, diuji di tests/findDocument.test.ts).
 * "NIB Rally District" cocok dengan "📚 nib_rally_district.pdf" (project Rally District).
 */

export const GENERATED_DOC_TAG = "dokumen-dibuat";
export const DOC_TAGS = ["dokumen-lengkap", "dokumen", GENERATED_DOC_TAG];

const PREFIXES = ["📝", "📚", "📄"];
/** Buang ikon awalan judul catatan ("📚 nib.pdf" -> "nib.pdf"). */
export function plainTitle(t: string): string {
  const s = String(t || "");
  const p = PREFIXES.find((x) => s.startsWith(x));
  return (p ? s.slice(p.length) : s).trim();
}

const STOP = new Set([
  "dokumen", "file", "berkas", "kirim", "kirimkan", "minta", "tolong", "yang", "dan", "ke", "di", "dari", "saya", "aku", "asli",
  "pdf", "docx", "word", "versi", "the", "untuk", "itu", "ini", "punya", "milik", "dong", "ya",
]);

function words(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}\b/g, " ") // ekstensi file
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
}

export function queryWords(q: string): string[] {
  return Array.from(new Set(words(q).filter((w) => !STOP.has(w))));
}

/** Skor kecocokan satu catatan terhadap kata kunci. */
export function scoreDocument(row: { title: string; tags?: string[] | null; content?: string | null; project?: { name?: string } | null }, q: string[]): number {
  if (!q.length) return 0;
  const title = new Set(words(plainTitle(row.title)));
  const titleJoined = words(plainTitle(row.title)).join("");
  const project = new Set(words(row.project?.name || ""));
  let hit = 0;
  let score = 0;
  for (const w of q) {
    if (title.has(w)) {
      score += 3;
      hit++;
    } else if (titleJoined.includes(w) && w.length >= 3) {
      score += 2;
      hit++;
    } else if (project.has(w)) {
      score += 2;
      hit++;
    }
  }
  if (!hit) return 0;
  if (hit === q.length) score += 3; // semua kata ketemu
  const tags = row.tags || [];
  if (tags.includes("dokumen-lengkap")) score += 1.5; // teks utuh + lokasi file asli
  else if (tags.includes(GENERATED_DOC_TAG)) score += 1;
  return score;
}

export function pickDocument<T extends { title: string; tags?: string[] | null; updated_at?: string }>(rows: T[], query: string) {
  const q = queryWords(query);
  const scored = rows
    .map((r) => ({ r, s: scoreDocument(r as any, q) }))
    .filter((x) => x.s >= 3)
    .sort((a, b) => b.s - a.s || String(b.r.updated_at || "").localeCompare(String(a.r.updated_at || "")));
  if (!scored.length) return null;
  return { best: scored[0].r, others: scored.slice(1, 5).map((x) => x.r) };
}

/** Pisahkan trailer lokasi file asli ("File asli: D:\..." atau "File: D:\...") dari isi catatan. */
export function splitOriginalPath(content: string): { text: string; path: string | null } {
  const m = content.match(/\n*(?:---\n)?File(?: asli)?: (.+)\s*$/);
  if (!m) return { text: content, path: null };
  const p = m[1].trim();
  const looksPath = /^[a-zA-Z]:[\\/]|^\/|^storage:documents\//.test(p);
  return { text: content.slice(0, m.index).trim(), path: looksPath ? p : null };
}

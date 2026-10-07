/**
 * Helper murni (tanpa database) untuk pendaftaran akun.
 * Dipisah agar mudah diuji (tests/unit/accountNormalize.test.ts).
 */

/** Nama resmi service + kategori untuk sebutan yang umum dipakai. */
const SERVICE_ALIASES: Record<string, { name: string; category: string }> = {
  github: { name: "GitHub", category: "code" },
  gitlab: { name: "GitLab", category: "code" },
  bitbucket: { name: "Bitbucket", category: "code" },
  google: { name: "Google", category: "productivity" },
  gmail: { name: "Google", category: "productivity" },
  "google-workspace": { name: "Google", category: "productivity" },
  "google-drive": { name: "Google", category: "productivity" },
  "google-cloud": { name: "Google Cloud", category: "cloud" },
  gcp: { name: "Google Cloud", category: "cloud" },
  supabase: { name: "Supabase", category: "database" },
  firebase: { name: "Firebase", category: "database" },
  vercel: { name: "Vercel", category: "hosting" },
  netlify: { name: "Netlify", category: "hosting" },
  cpanel: { name: "cPanel", category: "hosting" },
  rumahweb: { name: "Rumahweb", category: "hosting" },
  cloudflare: { name: "Cloudflare", category: "hosting" },
  aws: { name: "AWS", category: "cloud" },
  azure: { name: "Microsoft Azure", category: "cloud" },
  microsoft: { name: "Microsoft", category: "productivity" },
  outlook: { name: "Microsoft", category: "productivity" },
  openai: { name: "OpenAI", category: "ai" },
  chatgpt: { name: "OpenAI", category: "ai" },
  anthropic: { name: "Anthropic", category: "ai" },
  claude: { name: "Anthropic", category: "ai" },
  meta: { name: "Meta", category: "communication" },
  whatsapp: { name: "Meta", category: "communication" },
  fonnte: { name: "Fonnte", category: "communication" },
  xendit: { name: "Xendit", category: "payment" },
  midtrans: { name: "Midtrans", category: "payment" },
  notion: { name: "Notion", category: "productivity" },
  figma: { name: "Figma", category: "design" },
  canva: { name: "Canva", category: "design" },
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "github" / "GitHub " / "Gmail" -> nama, slug, kategori yang konsisten. */
export function resolveServiceName(raw: string): { name: string; slug: string; category: string } {
  const cleaned = raw.trim();
  const key = slugify(cleaned);
  const alias = SERVICE_ALIASES[key];
  if (alias) return { name: alias.name, slug: slugify(alias.name), category: alias.category };
  // Tidak dikenal: pakai nama apa adanya dengan huruf awal kapital
  const name = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return { name, slug: key, category: "other" };
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Escape karakter wildcard untuk filter ilike PostgREST. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export interface NamedRow {
  id: string;
  name: string;
  slug?: string | null;
}

export type MatchResult =
  | { kind: "match"; row: NamedRow }
  | { kind: "none" }
  | { kind: "ambiguous"; options: NamedRow[] };

/**
 * Cocokkan nama yang diketik pengguna ke daftar project/aplikasi.
 * Urutan: sama persis (nama/slug) -> satu-satunya yang mengandung kata -> ambigu.
 */
export function matchByName(query: string, rows: NamedRow[]): MatchResult {
  const q = query.trim().toLowerCase();
  const qs = slugify(query);
  if (!q) return { kind: "none" };
  const exact = rows.filter((r) => r.name.toLowerCase() === q || (r.slug || "") === qs || slugify(r.name) === qs);
  if (exact.length === 1) return { kind: "match", row: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", options: exact };
  const partial = rows.filter((r) => r.name.toLowerCase().includes(q) || slugify(r.name).includes(qs));
  if (partial.length === 1) return { kind: "match", row: partial[0] };
  if (partial.length > 1) return { kind: "ambiguous", options: partial };
  return { kind: "none" };
}

/** Gabung tag tanpa duplikat (tidak peka huruf besar/kecil). */
export function mergeTags(a: string[] | null | undefined, b: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...(a || []), ...(b || [])]) {
    const v = t.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

/** Tanda-tanda teks berisi rahasia; data seperti ini harus ke Vault, bukan ke catatan akun. */
export function looksLikeSecret(text: string | null | undefined): boolean {
  if (!text) return false;
  return /(password|passwd|kata\s*sandi|sandi\s*:|pwd\s*[:=]|api[_\s-]?key|secret|token\s*[:=]|sk-[a-z0-9]{10,}|pin\s*[:=])/i.test(
    text
  );
}

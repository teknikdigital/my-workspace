/**
 * Helper murni untuk mendaftarkan resource (repository, database, deployment, dokumen).
 * Menebak kategori dari URL dan peran (role) di project. Diuji di tests/resourceClassify.test.ts.
 */

export type ResourceCategory =
  | "github"
  | "supabase"
  | "vercel"
  | "apps_script"
  | "google_sheet"
  | "google_drive"
  | "figma"
  | "postman"
  | "documentation"
  | "production"
  | "staging"
  | "other";

export type ResourceRole = "repository" | "database" | "deployment" | "documentation" | "other";

export const ROLES: ResourceRole[] = ["repository", "database", "deployment", "documentation", "other"];

/** Tambahkan https:// bila pengguna menulis "github.com/..." saja. Mengembalikan null bila bukan URL. */
export function normalizeUrl(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) {
    if (!/^[\w.-]+\.[a-z]{2,}(\/|$|:)/i.test(u)) return null;
    u = `https://${u}`;
  }
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function guessCategory(url: string | null, hint?: string | null): ResourceCategory {
  const h = (hint || "").toLowerCase();
  const u = (url || "").toLowerCase();
  if (/github\.com/.test(u) || h === "github") return "github";
  if (/supabase\.(co|com)/.test(u) || h === "supabase") return "supabase";
  if (/vercel\.(app|com)/.test(u) || h === "vercel") return "vercel";
  if (/script\.google\.com/.test(u)) return "apps_script";
  if (/docs\.google\.com\/spreadsheets/.test(u)) return "google_sheet";
  if (/(drive|docs)\.google\.com/.test(u)) return "google_drive";
  if (/figma\.com/.test(u) || h === "figma") return "figma";
  if (/postman\.(com|co)/.test(u)) return "postman";
  if (h === "deployment" || h === "production") return "production";
  if (h === "staging") return "staging";
  if (h === "documentation") return "documentation";
  return "other";
}

export function roleFromCategory(c: ResourceCategory): ResourceRole {
  if (c === "github") return "repository";
  if (c === "supabase") return "database";
  if (c === "vercel" || c === "production" || c === "staging") return "deployment";
  if (c === "documentation" || c === "google_drive" || c === "google_sheet" || c === "figma") return "documentation";
  return "other";
}

/** Nama tampilan default, mis. "GitHub: julian/rally-district" atau "Supabase: abcd1234". */
export function deriveResourceName(url: string | null, category: ResourceCategory, given?: string | null): string {
  if (given && given.trim()) return given.trim().slice(0, 120);
  if (!url) return category;
  try {
    const p = new URL(url);
    const label: Record<string, string> = { github: "GitHub", supabase: "Supabase", vercel: "Vercel", figma: "Figma" };
    if (category === "supabase") {
      const ref = p.hostname.split(".")[0] !== "supabase" ? p.hostname.split(".")[0] : p.pathname.split("/").filter(Boolean).pop();
      return `Supabase: ${ref}`;
    }
    const path = p.pathname.replace(/^\/|\/$/g, "");
    return `${label[category] || p.hostname}${path ? `: ${path}` : `: ${p.hostname}`}`.slice(0, 120);
  } catch {
    return category;
  }
}

/** Jenis aplikasi (enum app_type di database). */
export const APP_TYPES = ["nextjs", "apps_script", "pwa", "streamlit", "static", "backend", "other"] as const;
export type AppType = (typeof APP_TYPES)[number];

export function guessAppType(framework?: string | null, given?: string | null): AppType {
  const g = (given || "").toLowerCase() as AppType;
  if (APP_TYPES.includes(g)) return g;
  const f = (framework || "").toLowerCase();
  if (/next/.test(f)) return "nextjs";
  if (/apps?\s*script|gas/.test(f)) return "apps_script";
  if (/streamlit/.test(f)) return "streamlit";
  if (/express|nest|fastapi|flask|django|laravel|codeigniter|api|backend/.test(f)) return "backend";
  if (/pwa/.test(f)) return "pwa";
  if (/html|static|vite|react|vue/.test(f)) return "static";
  return "other";
}

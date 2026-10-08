/**
 * Sesi Supabase untuk pemilik bot (WhatsApp / Telegram), dibuat di server tanpa browser:
 * admin.generateLink (magic link, TIDAK mengirim email) -> verifyOtp -> access & refresh token.
 * Dipakai bersama runAsUser() agar AI berjalan dengan hak akses (RLS) pemilik, bukan service role.
 * Disimpan di memori proses dan diperpanjang otomatis sebelum kedaluwarsa.
 */

import { createClient as createJsClient } from "@supabase/supabase-js";
import { noStoreFetch } from "@/lib/supabase/server";

interface CachedSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // detik epoch
  email: string;
}
let cached: CachedSession | null = null;

function anon() {
  return createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: noStoreFetch },
  });
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi");
  return createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: noStoreFetch },
  });
}

/** "julianpandanu@gmail.com" -> "ju***@gmail.com" (untuk pesan error, tanpa membocorkan email utuh). */
export function maskEmail(e: string): string {
  const [name, domain] = String(e || "").split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}

/**
 * Cari user Supabase berdasarkan email. Sengaja TIDAK membuat user baru dan TIDAK menebak user lain:
 * salah email harus terlihat jelas, bukan diam-diam memakai akun kosong / akun yang salah.
 */
async function findUserByEmail(email: string) {
  const a = admin();
  const seenEmails: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await a.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Gagal membaca daftar user: ${error.message}`);
    const users = data?.users || [];
    const hit = users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return { user: hit, seenEmails };
    seenEmails.push(...users.map((u) => u.email || "").filter(Boolean));
    if (users.length < 100) break;
  }
  return { user: null, seenEmails };
}

/** Email login My Workspace pemilik bot. MW_OWNER_EMAIL diutamakan; nama lama tetap didukung. */
export function ownerEmail(): string {
  const env = process.env;
  return String(env.MW_OWNER_EMAIL || env.WHATSAPP_OWNER_EMAIL || env.TELEGRAM_OWNER_EMAIL || "").trim().toLowerCase();
}

export async function getOwnerSession(): Promise<{ access_token: string; refresh_token: string; userId?: string }> {
  const email = ownerEmail();
  if (!email) throw new Error("Email pemilik belum diisi: isi MW_OWNER_EMAIL (atau WHATSAPP_OWNER_EMAIL) dengan email login My Workspace");
  const now = Math.floor(Date.now() / 1000);

  if (cached && cached.email === email) {
    if (cached.expires_at - now > 120) return cached;
    // perpanjang dengan refresh token
    const { data, error } = await anon().auth.refreshSession({ refresh_token: cached.refresh_token });
    if (!error && data.session) {
      cached = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at || now + 3000,
        email,
      };
      return cached;
    }
  }

  const { user, seenEmails } = await findUserByEmail(email);
  if (!user) {
    const list = seenEmails.slice(0, 5).map(maskEmail).join(", ");
    throw new Error(
      `Email pemilik (${maskEmail(email)}) tidak ditemukan di Supabase project ini. ` +
        (seenEmails.length
          ? `User yang ada: ${list}${seenEmails.length > 5 ? ", ..." : ""}. Isi MW_OWNER_EMAIL dengan email login My Workspace.`
          : "Project ini belum punya user sama sekali: cek NEXT_PUBLIC_SUPABASE_URL, mungkin mengarah ke project lain.")
    );
  }
  const { data: link, error: linkErr } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) throw new Error(`Gagal membuat sesi: ${linkErr?.message || "tanpa token"}`);
  const { data, error } = await anon().auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (error || !data.session) throw new Error(`Gagal verifikasi sesi: ${error?.message || "tanpa sesi"}`);
  cached = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at || now + 3000,
    email,
  };
  return { ...cached, userId: user.id };
}

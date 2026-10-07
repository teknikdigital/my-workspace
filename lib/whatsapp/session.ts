/**
 * Sesi Supabase untuk pemilik nomor WhatsApp, dibuat di server tanpa browser:
 * admin.generateLink (magic link, TIDAK mengirim email) -> verifyOtp -> access & refresh token.
 * Dipakai bersama runAsUser() agar AI berjalan dengan hak akses (RLS) pemilik, bukan service role.
 * Disimpan di memori proses dan diperpanjang otomatis sebelum kedaluwarsa.
 */

import { createClient as createJsClient } from "@supabase/supabase-js";

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
  });
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi");
  return createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Cari user Supabase berdasarkan email (tanpa membuat user baru). */
async function findUserByEmail(email: string) {
  const a = admin();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await a.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Gagal membaca daftar user: ${error.message}`);
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 100) break;
  }
  return null;
}

export async function getOwnerSession(): Promise<{ access_token: string; refresh_token: string; userId?: string }> {
  const email = String(process.env.WHATSAPP_OWNER_EMAIL || "").trim().toLowerCase();
  if (!email) throw new Error("WHATSAPP_OWNER_EMAIL belum diisi (email login My Workspace)");
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

  const user = await findUserByEmail(email);
  if (!user) throw new Error(`User dengan email ${email} tidak ditemukan di Supabase project ini`);
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

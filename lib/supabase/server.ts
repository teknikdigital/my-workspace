import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AsyncLocalStorage } from "async_hooks";

/**
 * Sesi pengguna tanpa cookie browser (mis. pesan WhatsApp diproses server).
 * Di dalam runAsUser(), semua createClient() memakai sesi ini sehingga RLS & auth.getUser() tetap berlaku
 * persis seperti pengguna sedang login di web. Di luar runAsUser(), perilaku lama (cookie) tidak berubah.
 */
interface UserSessionCtx {
  accessToken: string;
  refreshToken: string;
  client?: Promise<any>;
}
const sessionStore = new AsyncLocalStorage<UserSessionCtx>();

export function runAsUser<T>(session: { access_token: string; refresh_token: string }, fn: () => Promise<T>): Promise<T> {
  return sessionStore.run({ accessToken: session.access_token, refreshToken: session.refresh_token }, fn);
}

/**
 * fetch tanpa cache untuk semua klien Supabase di server.
 * Next.js 14 otomatis meng-cache fetch GET di route handler yang hanya punya method GET (mis. /api/claude-queue/next),
 * sehingga query baca Supabase bisa mengembalikan data basi selamanya. Data database selalu harus segar.
 */
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

async function sessionClient(ctx: UserSessionCtx) {
  const c = createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: noStoreFetch },
  });
  const { error } = await c.auth.setSession({ access_token: ctx.accessToken, refresh_token: ctx.refreshToken });
  if (error) throw new Error(`Sesi pengguna tidak valid: ${error.message}`);
  return c;
}

export async function createClient() {
  const ctx = sessionStore.getStore();
  if (ctx) {
    // satu client per pemrosesan pesan (setSession cukup sekali)
    ctx.client ||= sessionClient(ctx);
    return (await ctx.client) as ReturnType<typeof createServerClient>;
  }
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: noStoreFetch },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Can be ignored if called from Server Component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Can be ignored if called from Server Component
          }
        },
      },
    }
  );
}

export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined.");
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      global: { fetch: noStoreFetch },
      cookies: {
        get() { return undefined; },
        set() {},
        remove() {},
      },
    }
  );
}

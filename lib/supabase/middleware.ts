import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export function sanitizeNextUrl(nextParam: string | null | undefined): string {
  if (!nextParam) return "/";
  // Must start with exactly one '/', must not start with '//', and must not contain schema
  if (
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.includes("://") &&
    !nextParam.toLowerCase().startsWith("/\\")
  ) {
    return nextParam;
  }
  return "/";
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Allow public API webhook endpoints (e.g. WhatsApp/Telegram webhook, Activity webhook, Cron)
  if (
    pathname.startsWith("/api/whatsapp") ||
    pathname.startsWith("/api/telegram") ||
    pathname.startsWith("/api/claude-queue") || // agent laptop, auth token integrasi
    pathname.startsWith("/api/activity") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/privacy" // kebijakan privasi publik (syarat Meta)
  ) {
    return response;
  }

  // If user is not logged in and not on /login, redirect to /login?next=...
  if (!user && pathname !== "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is logged in and is visiting /login, redirect to sanitized next or /
  if (user && pathname === "/login") {
    const rawNext = request.nextUrl.searchParams.get("next");
    const safeNext = sanitizeNextUrl(rawNext);
    const redirectUrl = new URL(safeNext, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

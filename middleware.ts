import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, svg, icons (static asset extensions)
     * - api/activity (uses its own Bearer token auth)
     * - api/whatsapp (uses its own HMAC signature auth) - Fase 5
     */
    "/((?!_next/static|_next/image|favicon.ico|api/activity|api/whatsapp|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

"use server";

import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validators/auth";
import { sanitizeNextUrl } from "@/lib/supabase/middleware";
import { redirect } from "next/navigation";

export interface AuthActionResult {
  error?: string;
}

export async function signIn(formData: FormData): Promise<AuthActionResult | void> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nextParam = formData.get("next") as string | null;

  const parsed = signInSchema.safeParse({ email, password, next: nextParam || undefined });
  if (!parsed.success) {
    return { error: "Email atau kata sandi tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Check for rate limit
    if (error.status === 429 || error.message.toLowerCase().includes("rate limit")) {
      return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
    }
    // Generic error message to prevent enumeration
    return { error: "Email atau kata sandi salah." };
  }

  const safeTarget = sanitizeNextUrl(nextParam);
  redirect(safeTarget);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

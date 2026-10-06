/**
 * Script untuk membuat user pertama secara manual di Supabase via Service Role Key
 * Jalankan: npx tsx scripts/create-user.ts <email> <password> [displayName]
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local manually if not present in process.env
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/create-user.ts <email> <password> [displayName]");
    process.exit(1);
  }

  const [email, password, displayName] = args;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Error: Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY ada di .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Membuat user: ${email}...`);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName || email.split("@")[0],
    },
  });

  if (error) {
    console.error("Gagal membuat user:", error.message);
    process.exit(1);
  }

  console.log("User berhasil dibuat!");
  console.log("User ID:", data.user.id);
  console.log("Email:", data.user.email);
  console.log("\nUntuk mengisi data demo, jalankan SQL berikut di Supabase SQL Editor:");
  console.log(`SELECT seed_demo_data('${data.user.id}');`);
}

main().catch(console.error);

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Error: Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tersedia di .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function clearData() {
  console.log("Membersihkan seluruh data dummy di database...");

  const tables = [
    "activity_logs",
    "ai_messages",
    "ai_conversations",
    "integration_tokens",
    "integrations",
    "vault_audit_logs",
    "credentials",
    "documents",
    "reminders",
    "personal_links",
    "notes",
    "tasks",
    "project_accounts",
    "application_accounts",
    "project_resources",
    "application_resources",
    "resources",
    "applications",
    "projects",
    "accounts",
    "services",
  ];

  for (const table of tables) {
    // Delete all records where id is not null (or true for all)
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      // Junction tables might not have 'id', fallback to delete with gte/neq
      if (table.includes("_")) {
        const { error: juncError } = await supabase.from(table).delete().neq("created_at", "1970-01-01");
        if (juncError) {
          console.warn(`Peringatan saat menghapus tabel ${table}:`, juncError.message);
        }
      } else {
        console.warn(`Peringatan saat menghapus tabel ${table}:`, error.message);
      }
    } else {
      console.log(`✓ Tabel ${table} berhasil dibersihkan.`);
    }
  }

  console.log("\nSemua data dummy berhasil dibersihkan! Akun login (auth.users) tetap aman.");
}

clearData().catch(console.error);

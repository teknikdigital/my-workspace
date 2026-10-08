"use server";

/**
 * Pindai SELURUH data workspace pengguna untuk alamat email / nomor telepon.
 * Dipakai AI (tool find_contacts) untuk pertanyaan "semua email saya", karena search_workspace
 * hanya mengembalikan 5 hasil per jenis dan hanya mencocokkan kata kunci.
 *
 * Yang dikembalikan ke AI hanya: alamat/nomor + judul sumbernya. Isi catatan dan nilai rahasia Vault
 * TIDAK pernah ikut (Vault: hanya label & identifier; encrypted_value tidak dibaca).
 */

import { createClient } from "@/lib/supabase/server";
import { extractContacts, type ContactKind, type ContactSourceRow } from "@/lib/ai/contacts";

const MAX_ROWS = 2000;

type TableSpec = { table: string; type: string; cols: string; title: (r: any) => string; text: (r: any) => (string | null | undefined)[] };

const TABLES: TableSpec[] = [
  { table: "notes", type: "catatan", cols: "title, body", title: (r) => r.title || "Catatan tanpa judul", text: (r) => [r.title, r.body] },
  { table: "accounts", type: "akun", cols: "label, identifier, notes", title: (r) => r.label, text: (r) => [r.label, r.identifier, r.notes] },
  { table: "credentials", type: "vault", cols: "label, identifier", title: (r) => r.label, text: (r) => [r.label, r.identifier] },
  { table: "projects", type: "project", cols: "name, description", title: (r) => r.name, text: (r) => [r.name, r.description] },
  { table: "applications", type: "aplikasi", cols: "name, production_url, staging_url", title: (r) => r.name, text: (r) => [r.name, r.production_url, r.staging_url] },
  { table: "resources", type: "resource", cols: "title, url, notes", title: (r) => r.title, text: (r) => [r.title, r.url, r.notes] },
  { table: "tasks", type: "task", cols: "title, description", title: (r) => r.title, text: (r) => [r.title, r.description] },
  { table: "personal_links", type: "link pribadi", cols: "title, url, notes", title: (r) => r.title, text: (r) => [r.title, r.url, r.notes] },
];

export async function findContacts(kind: ContactKind = "email") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Belum login" };

  const rows: ContactSourceRow[] = [];
  const skipped: string[] = [];
  let truncated = false;
  await Promise.all(
    TABLES.map(async (t) => {
      const { data, error } = await supabase.from(t.table).select(t.cols).eq("user_id", user.id).limit(MAX_ROWS);
      if (error) {
        skipped.push(t.table);
        return;
      }
      if ((data || []).length >= MAX_ROWS) truncated = true;
      for (const r of data || []) rows.push({ type: t.type, title: t.title(r), text: t.text(r).filter(Boolean).join("\n") });
    })
  );

  const contacts = extractContacts(rows, kind);
  return {
    success: true,
    kind,
    total: contacts.length,
    contacts,
    scanned: rows.length,
    ...(skipped.length ? { skipped_tables: skipped } : {}),
    ...(truncated ? { note: `Sebagian tabel punya lebih dari ${MAX_ROWS} baris; yang terpindai hanya ${MAX_ROWS} pertama per tabel.` } : {}),
  };
}

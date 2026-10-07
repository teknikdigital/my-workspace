"use server";

/**
 * registerAccount: satu pintu untuk mendaftarkan akun dan menyambungkannya ke seluruh workspace.
 *
 * Alur:
 *  1. Service dicari/dibuat (alias: gmail -> Google, chatgpt -> OpenAI, dst).
 *  2. Akun dicari dulu (service + email/username sama) -> diperbarui, bukan dibuat ganda.
 *  3. Disambungkan ke project & aplikasi berdasarkan nama (ambigu -> dikembalikan untuk ditanyakan).
 *  4. Dicatat ke Activity, lalu semua menu terkait di-revalidate.
 *
 * Dipakai oleh AI tool `register_account`. Nilai rahasia (password/API key) TIDAK diterima di sini:
 * harus lewat Vault (create_vault_credential).
 *
 * Skema yang diasumsikan: supabase/full_schema.sql (accounts.email NOT NULL, project_accounts tanpa user_id).
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  escapeLike,
  isEmail,
  looksLikeSecret,
  matchByName,
  mergeTags,
  resolveServiceName,
  type NamedRow,
} from "@/lib/accounts/normalize";

export interface RegisterAccountInput {
  service: string;
  email?: string;
  username?: string;
  label?: string;
  phone?: string;
  purpose_tags?: string[];
  notes?: string;
  is_personal?: boolean;
  projects?: string[];
  applications?: string[];
  role?: string; // peran akun di project/aplikasi, default "owner"
}

export interface RegisterAccountResult {
  success: boolean;
  error?: string;
  action?: "created" | "updated" | "linked_only";
  account?: { id: string; label: string | null; email: string; service: string };
  service_created?: boolean;
  linked?: { projects: string[]; applications: string[] };
  not_found?: { projects: string[]; applications: string[] };
  ambiguous?: { query: string; type: "project" | "application" | "account"; options: string[] }[];
  warnings?: string[];
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function findOrCreateService(supabase: Supa, userId: string, raw: string) {
  const svc = resolveServiceName(raw);
  // Cari berdasarkan slug, lalu nama (tidak peka huruf besar/kecil). Dua query terpisah agar
  // nama yang mengandung koma/tanda kurung tidak merusak sintaks filter .or().
  const bySlug = await supabase.from("services").select("id, name, slug").eq("slug", svc.slug).limit(1);
  if (bySlug.data && bySlug.data.length) return { row: bySlug.data[0], created: false };
  const byName = await supabase.from("services").select("id, name, slug").ilike("name", escapeLike(svc.name)).limit(1);
  if (byName.data && byName.data.length) return { row: byName.data[0], created: false };

  const { data, error } = await supabase
    .from("services")
    .insert({ user_id: userId, name: svc.name, slug: svc.slug, category: svc.category })
    .select("id, name, slug")
    .single();
  if (error) throw new Error(`Gagal membuat service ${svc.name}: ${error.message}`);
  return { row: data, created: true };
}

async function linkByNames(
  supabase: Supa,
  kind: "project" | "application",
  names: string[],
  accountId: string,
  role: string,
  result: RegisterAccountResult
) {
  if (!names.length) return [] as NamedRow[];
  const table = kind === "project" ? "projects" : "applications";
  const { data: rows, error } = await supabase.from(table).select("id, name, slug");
  if (error) throw new Error(`Gagal membaca ${table}: ${error.message}`);

  const linkedRows: NamedRow[] = [];
  for (const name of names) {
    const m = matchByName(name, (rows || []) as NamedRow[]);
    if (m.kind === "none") {
      (kind === "project" ? result.not_found!.projects : result.not_found!.applications).push(name);
    } else if (m.kind === "ambiguous") {
      result.ambiguous!.push({ query: name, type: kind, options: m.options.map((o) => o.name) });
    } else {
      const rel =
        kind === "project"
          ? supabase
              .from("project_accounts")
              .upsert({ project_id: m.row.id, account_id: accountId, role }, { onConflict: "project_id,account_id" })
          : supabase
              .from("application_accounts")
              .upsert({ application_id: m.row.id, account_id: accountId, role }, { onConflict: "application_id,account_id" });
      const { error: linkErr } = await rel;
      if (linkErr) throw new Error(`Gagal menghubungkan ke ${kind} ${m.row.name}: ${linkErr.message}`);
      linkedRows.push(m.row);
      (kind === "project" ? result.linked!.projects : result.linked!.applications).push(m.row.name);
    }
  }
  return linkedRows;
}

export async function registerAccount(input: RegisterAccountInput): Promise<RegisterAccountResult> {
  const result: RegisterAccountResult = {
    success: false,
    linked: { projects: [], applications: [] },
    not_found: { projects: [], applications: [] },
    ambiguous: [],
    warnings: [],
  };

  if (!input.service || !input.service.trim()) return { ...result, error: "Nama layanan (service) wajib diisi" };
  if (looksLikeSecret(input.notes) || looksLikeSecret(input.label)) {
    return {
      ...result,
      error:
        "Catatan/label terlihat berisi password atau API key. Simpan rahasia lewat Vault (create_vault_credential), bukan di data akun.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...result, error: "Tidak terautentikasi" };

  try {
    // 1. Service
    const { row: service, created: serviceCreated } = await findOrCreateService(supabase, user.id, input.service);
    result.service_created = serviceCreated;

    // 2. Cari akun yang sudah ada di service ini
    const email = input.email?.trim() || "";
    const username = input.username?.trim() || "";
    const { data: candidates, error: accErr } = await supabase
      .from("accounts")
      .select("id, email, username, identifier, label, purpose_tags, notes, phone")
      .eq("service_id", service.id);
    if (accErr) throw new Error(`Gagal membaca akun: ${accErr.message}`);

    const keys = [email, username].filter(Boolean).map((s) => s.toLowerCase());
    let existing = (candidates || []).find((a) =>
      [a.email, a.username, a.identifier].some((v) => v && keys.includes(String(v).toLowerCase()))
    );

    // Tanpa email/username: pakai akun satu-satunya di service ini (mis. "hubungkan akun GitHub saya ke X")
    if (!existing && keys.length === 0) {
      if ((candidates || []).length === 1) existing = candidates![0];
      else if ((candidates || []).length > 1) {
        result.ambiguous!.push({
          query: service.name,
          type: "account",
          options: candidates!.map((c) => c.email || c.username || c.label || c.id),
        });
        return { ...result, error: `Ada beberapa akun ${service.name}. Sebutkan email/username yang dimaksud.` };
      } else {
        return { ...result, error: `Belum ada akun ${service.name}. Sebutkan email atau username akunnya.` };
      }
    }

    // 3. Buat / perbarui akun
    let accountId: string;
    let accountRow: { id: string; label: string | null; email: string };
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (input.label) patch.label = input.label;
      if (username && !existing.username) patch.username = username;
      if (input.phone) patch.phone = input.phone;
      if (input.notes) patch.notes = existing.notes ? `${existing.notes}\n${input.notes}` : input.notes;
      if (input.purpose_tags?.length) patch.purpose_tags = mergeTags(existing.purpose_tags, input.purpose_tags);
      if (typeof input.is_personal === "boolean") patch.is_personal = input.is_personal;
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("accounts").update(patch).eq("id", existing.id);
        if (error) throw new Error(`Gagal memperbarui akun: ${error.message}`);
        result.action = "updated";
      } else {
        result.action = "linked_only";
      }
      accountId = existing.id;
      accountRow = { id: existing.id, label: (patch.label as string) || existing.label, email: existing.email };
    } else {
      // accounts.email NOT NULL: bila hanya username, simpan username di kolom email & identifier
      const primary = email || username;
      if (email && !isEmail(email)) result.warnings!.push(`"${email}" bukan format email yang valid, tetap disimpan.`);
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          service_id: service.id,
          email: primary,
          identifier: primary,
          username: username || null,
          label: input.label || `${service.name} - ${primary}`,
          phone: input.phone || null,
          purpose_tags: mergeTags([], input.purpose_tags),
          notes: input.notes || null,
          is_personal: input.is_personal ?? false,
        })
        .select("id, label, email")
        .single();
      if (error) throw new Error(`Gagal menyimpan akun: ${error.message}`);
      accountId = data.id;
      accountRow = data;
      result.action = "created";
    }

    // 4. Sambungkan ke project & aplikasi
    const role = input.role || "owner";
    const linkedProjects = await linkByNames(supabase, "project", input.projects || [], accountId, role, result);
    await linkByNames(supabase, "application", input.applications || [], accountId, role, result);

    // 5. Catat aktivitas (satu baris ringkas)
    const verb = result.action === "created" ? "ditambahkan" : result.action === "updated" ? "diperbarui" : "dihubungkan";
    const links = [...result.linked!.projects, ...result.linked!.applications];
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      project_id: linkedProjects[0]?.id || null,
      summary: `Akun ${service.name} (${accountRow.email}) ${verb}${links.length ? `, terhubung ke: ${links.join(", ")}` : ""}`,
      activity_type: "configuration",
      source: "ai",
    });

    // 6. Segarkan semua menu yang menampilkan akun
    for (const p of ["/", "/work/accounts", "/work/projects", "/work/applications", "/work/activity", "/ai"]) revalidatePath(p);
    revalidatePath("/work/projects/[id]", "page");

    result.success = true;
    result.account = { id: accountId, label: accountRow.label, email: accountRow.email, service: service.name };
    return result;
  } catch (e) {
    return { ...result, error: (e as Error).message };
  }
}

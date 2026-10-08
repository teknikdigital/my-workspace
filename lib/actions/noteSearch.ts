"use server";

/**
 * Pencarian catatan untuk AI: sampai 20 catatan, dengan potongan isi di sekitar kata kunci
 * (search_workspace hanya memberi 5 catatan dan 80 karakter pertama, sehingga isi penting terlewat).
 */

import { createClient } from "@/lib/supabase/server";
import { excerptAround } from "@/lib/ai/contacts";

export async function searchNotesForAi(query: string, limit = 20) {
  const q = String(query || "").trim();
  if (!q) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const words = q
    .split(/\s+/)
    .map((w) => w.replace(/[%,()*]/g, ""))
    .filter((w) => w.length >= 2)
    .slice(0, 5);
  if (!words.length) return [];
  // cocok bila SALAH SATU kata ada di judul/isi; diurutkan dari yang paling banyak cocok
  const or = words.flatMap((w) => [`title.ilike.%${w}%`, `body.ilike.%${w}%`]).join(",");
  const { data, error } = await supabase.from("notes").select("id, title, body, updated_at").eq("user_id", user.id).or(or).order("updated_at", { ascending: false }).limit(200);
  if (error || !data) return [];
  const score = (n: any) => {
    const t = `${n.title || ""}\n${n.body || ""}`.toLowerCase();
    return words.reduce((s, w) => s + (t.includes(w.toLowerCase()) ? 1 : 0), 0);
  };
  return data
    .map((n: any) => ({ n, s: score(n) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ n }) => ({ id: n.id, title: n.title || "Catatan tanpa judul", excerpts: excerptAround(n.body || "", q), updated_at: n.updated_at }));
}

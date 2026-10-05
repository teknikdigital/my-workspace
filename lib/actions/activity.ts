"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getRecentActivities(limit = 10) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("activity_logs")
    .select(`
      *,
      project:projects (id, name)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching activity logs:", error.message);
    return [];
  }
  return data || [];
}

export async function createActivity(summary: string, projectId?: string, source = "manual") {
  if (!summary || !summary.trim()) return { error: "Summary tidak boleh kosong" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("activity_logs")
    .insert({
      user_id: user.id,
      summary: summary.trim(),
      project_id: projectId || null,
      source,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/work/activity");
  return { data };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { resourceSchema, type ResourceInput } from "@/lib/validators/resources";
import { revalidatePath } from "next/cache";

export async function getResources() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("resources")
    .select(`
      *,
      service:services (id, name, slug)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching resources:", error.message);
    return [];
  }
  return data || [];
}

export async function createResource(input: ResourceInput) {
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("resources")
    .insert({
      user_id: user.id,
      ...parsed.data,
      // resources.name NOT NULL (full_schema.sql): isi dari judul
      name: parsed.data.title,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/resources");
  revalidatePath("/work/projects");
  return { data };
}

export async function updateResource(id: string, input: Partial<ResourceInput>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("resources")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/resources");
  return { data };
}

export async function deleteResource(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/work/resources");
  return { success: true };
}

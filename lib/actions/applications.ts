"use server";

import { createClient } from "@/lib/supabase/server";
import { applicationSchema, type ApplicationInput } from "@/lib/validators/applications";
import { revalidatePath } from "next/cache";

export async function getApplications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("applications")
    .select(`
      *,
      project:projects (id, name),
      application_resources (
        resource_id,
        role,
        resources (id, name, url, category, services (name))
      ),
      application_accounts (
        account_id,
        accounts (id, label, email, username, services (name))
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching applications:", error.message);
    return [];
  }
  return data || [];
}

export async function createApplication(input: ApplicationInput) {
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      ...parsed.data,
      // applications.slug NOT NULL & app_type (enum) di full_schema.sql
      slug:
        parsed.data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "app",
      app_type: parsed.data.type,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/applications");
  revalidatePath("/work/projects");
  return { data };
}

export async function updateApplication(id: string, input: Partial<ApplicationInput>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("applications")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/applications");
  return { data };
}

export async function deleteApplication(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("applications").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/work/applications");
  return { success: true };
}

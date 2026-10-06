"use server";

import { createClient } from "@/lib/supabase/server";
import { projectSchema, type ProjectInput } from "@/lib/validators/projects";
import { revalidatePath } from "next/cache";

export async function getProjects() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      applications (id, name, app_type, status),
      project_accounts (
        account_id,
        accounts (id, label, email, username, services (name))
      ),
      project_resources (
        resource_id,
        role,
        resources (id, name, url, category)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error.message);
    return [];
  }
  return data || [];
}

export async function getProjectById(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      applications (*),
      project_accounts (
        account_id,
        accounts (*, services (name, slug))
      ),
      project_resources (
        resource_id,
        role,
        resources (*, services (name, slug))
      ),
      tasks (*),
      notes (*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching project by id:", error.message);
    return null;
  }
  return data;
}

export async function touchProjectLastOpened(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("projects")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", id);
}

export async function createProject(input: ProjectInput) {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const slug =
    parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "project";

  const tags = Array.from(
    new Set([
      ...(parsed.data.category ? [parsed.data.category] : []),
      ...(parsed.data.tech_stack || []),
    ])
  );

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      slug,
      tags,
      description: parsed.data.description,
      status: parsed.data.status,
      progress: parsed.data.progress,
      category: parsed.data.category,
      tech_stack: parsed.data.tech_stack,
      last_opened_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/projects");
  revalidatePath("/");
  return { data };
}

export async function updateProject(id: string, input: Partial<ProjectInput>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/work/projects/${id}`);
  revalidatePath("/work/projects");
  revalidatePath("/");
  return { data };
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/work/projects");
  revalidatePath("/");
  return { success: true };
}

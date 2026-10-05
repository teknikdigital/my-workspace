"use server";

import { createClient } from "@/lib/supabase/server";
import { taskSchema, type TaskInput } from "@/lib/validators/tasks";
import { revalidatePath } from "next/cache";

export async function getTasks() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      project:projects (id, name),
      application:applications (id, name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tasks:", error.message);
    return [];
  }
  return data || [];
}

export async function createTask(input: TaskInput) {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      ...parsed.data,
      completed_at: parsed.data.status === "done" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/tasks");
  revalidatePath("/");
  return { data };
}

export async function updateTask(id: string, input: Partial<TaskInput>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const payload: any = { ...input };
  if (input.status === "done") {
    payload.completed_at = new Date().toISOString();
  } else if (input.status === "todo" || input.status === "in_progress") {
    payload.completed_at = null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/tasks");
  revalidatePath("/");
  return { data };
}

export async function toggleTaskStatus(id: string, currentStatus: string) {
  const newStatus = currentStatus === "done" ? "todo" : "done";
  return await updateTask(id, { status: newStatus as any });
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/work/tasks");
  revalidatePath("/");
  return { success: true };
}

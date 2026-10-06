"use server";

import { createClient } from "@/lib/supabase/server";
import { noteSchema, type NoteInput } from "@/lib/validators/notes";
import { revalidatePath } from "next/cache";

export async function getNotes(options?: {
  tag?: string;
  projectId?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase.from("notes").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching notes:", error.message);
    return [];
  }
  return data || [];
}

export async function createNote(input: NoteInput) {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const rawTitle = (parsed.data.title || "").trim();
  const rawContent = (parsed.data.content || parsed.data.body || "").trim();

  if (!rawTitle && !rawContent) {
    return { error: "Judul atau isi catatan tidak boleh kosong" };
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      title: rawTitle || rawContent.slice(0, 40) || "Catatan Baru",
      content: rawContent,
      tags: parsed.data.tags || [],
      project_id: parsed.data.project_id || null,
      application_id: parsed.data.application_id || null,
      is_pinned: parsed.data.is_pinned || false,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/personal/notes");
  revalidatePath("/work/notes");
  return { data };
}

export async function updateNote(id: string, input: Partial<NoteInput>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const updatePayload: Record<string, any> = {};
  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.content !== undefined) updatePayload.content = input.content;
  if (input.body !== undefined) updatePayload.content = input.body;
  if (input.tags !== undefined) updatePayload.tags = input.tags;
  if (input.project_id !== undefined) updatePayload.project_id = input.project_id;
  if (input.application_id !== undefined) updatePayload.application_id = input.application_id;
  if (input.is_pinned !== undefined) updatePayload.is_pinned = input.is_pinned;

  const { data, error } = await supabase
    .from("notes")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/personal/notes");
  revalidatePath("/work/notes");
  return { data };
}

export async function deleteNote(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/personal/notes");
  revalidatePath("/work/notes");
  return { success: true };
}

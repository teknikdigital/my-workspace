"use server";

import { createClient } from "@/lib/supabase/server";
import { noteSchema, type NoteInput } from "@/lib/validators/notes";
import { revalidatePath } from "next/cache";

export async function getNotes(scope?: "personal" | "work" | "project") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase.from("notes").select("*").order("created_at", { ascending: false });
  if (scope) {
    query = query.eq("scope", scope);
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

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      ...parsed.data,
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

  const { data, error } = await supabase
    .from("notes")
    .update(input)
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

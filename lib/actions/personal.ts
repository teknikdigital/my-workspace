"use server";

import { createClient } from "@/lib/supabase/server";
import {
  reminderSchema,
  personalLinkSchema,
  documentSchema,
  type ReminderInput,
  type PersonalLinkInput,
  type DocumentInput,
} from "@/lib/validators/personal";
import type { ReminderItem, PersonalLink, DocumentItem } from "@/types/database";
import { revalidatePath } from "next/cache";

// ==========================================
// REMINDERS
// ==========================================
export async function getReminders(): Promise<ReminderItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .order("due_at", { ascending: true });

  if (error) {
    console.error("Error fetching reminders:", error.message);
    return [];
  }
  return data || [];
}

export async function createReminder(input: ReminderInput) {
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      due_at: parsed.data.due_at,
      source: parsed.data.source,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/personal/reminders");
  revalidatePath("/");
  return { data };
}

export async function toggleReminder(id: string, currentStatus: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("reminders")
    .update({ is_completed: !currentStatus })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/personal/reminders");
  revalidatePath("/");
  return { data };
}

export async function deleteReminder(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/personal/reminders");
  return { success: true };
}

// ==========================================
// PERSONAL LINKS
// ==========================================
export async function getPersonalLinks(): Promise<PersonalLink[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("personal_links")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching personal links:", error.message);
    return [];
  }
  return data || [];
}

export async function createPersonalLink(input: PersonalLinkInput) {
  const parsed = personalLinkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("personal_links")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      url: parsed.data.url,
      tags: parsed.data.tags,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/personal/links");
  return { data };
}

export async function deletePersonalLink(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("personal_links").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/personal/links");
  return { success: true };
}

// ==========================================
// DOCUMENTS & SUPABASE STORAGE
// ==========================================
export async function getDocuments(): Promise<DocumentItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching documents:", error.message);
    return [];
  }
  return data || [];
}

export async function createDocumentRecord(input: DocumentInput) {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      file_path: parsed.data.file_path,
      file_size: parsed.data.file_size || null,
      mime_type: parsed.data.mime_type || null,
      category: parsed.data.category,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/personal/documents");
  return { data };
}

export async function getDocumentSignedUrl(filePath: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  // Generate 60-second signed download URL
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 60);

  if (error) return { error: error.message };
  return { signedUrl: data.signedUrl };
}

export async function deleteDocument(id: string, filePath: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  // 1. Delete from storage bucket
  await supabase.storage.from("documents").remove([filePath]);

  // 2. Delete row
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/personal/documents");
  return { success: true };
}

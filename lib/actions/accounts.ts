"use server";

import { createClient } from "@/lib/supabase/server";
import { accountSchema, type AccountInput } from "@/lib/validators/accounts";
import { revalidatePath } from "next/cache";

export async function getAccounts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("accounts")
    .select(`
      *,
      service:services (*),
      project_accounts (
        project:projects (id, name)
      ),
      application_accounts (
        application:applications (id, name)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching accounts:", error.message);
    return [];
  }
  return data || [];
}

export async function getServices() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("name", { ascending: true });

  if (error) return [];
  return data || [];
}

export async function createAccount(input: AccountInput) {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/accounts");
  return { data };
}

export async function updateAccount(id: string, input: Partial<AccountInput>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("accounts")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/accounts");
  return { data };
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/work/accounts");
  return { success: true };
}

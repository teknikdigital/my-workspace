"use server";

import { createClient } from "@/lib/supabase/server";
import {
  credentialSchema,
  revealCredentialSchema,
  type CredentialInput,
  type RevealCredentialInput,
} from "@/lib/validators/vault";
import { encryptVaultValue, decryptVaultValue } from "@/lib/vault/crypto";
import type { CredentialMetadata, VaultAuditLog } from "@/types/database";
import { revalidatePath } from "next/cache";

export async function getCredentialsMetadata(): Promise<CredentialMetadata[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Strictly select metadata only — NEVER return encrypted_value or raw key to client
  const { data, error } = await supabase
    .from("credentials")
    .select(`
      id,
      user_id,
      service_id,
      label,
      identifier,
      credential_type,
      notes,
      created_at,
      updated_at,
      service:services (id, name, slug)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching credentials metadata:", error.message);
    return [];
  }
  return (data as any) || [];
}

export async function createCredential(input: CredentialInput) {
  const parsed = credentialSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  try {
    // 1. Encrypt secret value using AES-256-GCM
    const encrypted = encryptVaultValue(parsed.data.secret_value);

    // 2. Insert into credentials table
    const { data, error } = await supabase
      .from("credentials")
      .insert({
        user_id: user.id,
        service_id: parsed.data.service_id || null,
        label: parsed.data.label,
        identifier: parsed.data.identifier || null,
        credential_type: parsed.data.credential_type,
        encrypted_value: encrypted.encryptedValue,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        notes: parsed.data.notes || null,
      })
      .select("id, label, credential_type")
      .single();

    if (error) return { error: error.message };

    // 3. Log Audit (Zero Secret Value Logged)
    await supabase.from("vault_audit_logs").insert({
      user_id: user.id,
      credential_id: data.id,
      credential_label: data.label,
      action: "create",
    });

    revalidatePath("/vault");
    return { data };
  } catch (err: any) {
    return { error: err.message || "Gagal mengenkripsi kredensial." };
  }
}

export async function revealCredential(input: RevealCredentialInput) {
  const parsed = revealCredentialSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: "Tidak terautentikasi" };

  // 1. Re-authenticate user with their password
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.auth_password,
  });

  if (authError) {
    return { error: "Kata sandi salah. Verifikasi keamanan gagal." };
  }

  // 2. Fetch encrypted secret from server
  const { data: cred, error: fetchError } = await supabase
    .from("credentials")
    .select("id, label, encrypted_value, iv, auth_tag")
    .eq("id", parsed.data.credential_id)
    .single();

  if (fetchError || !cred) {
    return { error: "Kredensial tidak ditemukan." };
  }

  try {
    // 3. Decrypt on server
    const decrypted = decryptVaultValue(
      cred.encrypted_value,
      cred.iv,
      cred.auth_tag
    );

    // 4. Log Audit (Zero secret logged)
    await supabase.from("vault_audit_logs").insert({
      user_id: user.id,
      credential_id: cred.id,
      credential_label: cred.label,
      action: parsed.data.action,
    });

    revalidatePath("/vault");
    return { decryptedValue: decrypted };
  } catch (err: any) {
    return { error: "Gagal mendekripsi kredensial." };
  }
}

export async function deleteCredential(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  // Fetch label for audit before deletion
  const { data: cred } = await supabase
    .from("credentials")
    .select("label")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("credentials").delete().eq("id", id);
  if (error) return { error: error.message };

  // Log Audit
  await supabase.from("vault_audit_logs").insert({
    user_id: user.id,
    credential_id: id,
    credential_label: cred?.label || "Unknown",
    action: "delete",
  });

  revalidatePath("/vault");
  return { success: true };
}

export async function getVaultAuditLogs(limit = 20): Promise<VaultAuditLog[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("vault_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching vault audit logs:", error.message);
    return [];
  }
  return data || [];
}

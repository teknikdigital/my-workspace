"use server";

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { encryptVaultValue } from "@/lib/vault/crypto";
import {
  createIntegrationSchema,
  updateIntegrationSchema,
  createTokenSchema,
} from "@/lib/validators/integrations";
import type {
  Integration,
  IntegrationToken,
  IntegrationTokenWithPlaintext,
} from "@/types/integrations";

// ==============================================================================
// INTEGRATIONS
// ==============================================================================

export async function getIntegrations(): Promise<Integration[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("integrations")
    .select("id, user_id, provider, is_enabled, status, last_synced_at, created_at, updated_at")
    .order("provider");

  if (error) {
    console.error("Error fetching integrations:", error.message);
    return [];
  }
  return (data as Integration[]) || [];
}

export async function upsertIntegration(formData: {
  provider: string;
  is_enabled: boolean;
  config_value?: string;
}) {
  const parsed = createIntegrationSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Data tidak valid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  // Build the insert/update payload
  const payload: Record<string, unknown> = {
    user_id: user.id,
    provider: parsed.data.provider,
    is_enabled: parsed.data.is_enabled,
    status: parsed.data.is_enabled ? "connected" : "disconnected",
  };

  // If a config value is provided, encrypt it server-side
  if (parsed.data.config_value) {
    const encrypted = encryptVaultValue(parsed.data.config_value);
    payload.encrypted_config = encrypted.encryptedValue;
    payload.iv = encrypted.iv;
    payload.auth_tag = encrypted.authTag;
  }

  const { data, error } = await supabase
    .from("integrations")
    .upsert(payload, { onConflict: "user_id,provider" })
    .select("id, user_id, provider, is_enabled, status, last_synced_at, created_at, updated_at")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/settings");
  return { data: data as Integration };
}

export async function toggleIntegration(id: string, is_enabled: boolean) {
  const parsed = updateIntegrationSchema.safeParse({ id, is_enabled });
  if (!parsed.success) return { error: "Data tidak valid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { data, error } = await supabase
    .from("integrations")
    .update({
      is_enabled,
      status: is_enabled ? "connected" : "disconnected",
    })
    .eq("id", id)
    .select("id, user_id, provider, is_enabled, status, last_synced_at, created_at, updated_at")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/work/settings");
  return { data: data as Integration };
}

export async function deleteIntegration(id: string) {
  if (!id) return { error: "ID wajib diisi" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("integrations").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/work/settings");
  return { success: true };
}

// ==============================================================================
// INTEGRATION TOKENS (Bearer Tokens for External Webhook Auth)
// ==============================================================================

export async function getIntegrationTokens(): Promise<IntegrationToken[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("integration_tokens")
    .select("id, user_id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching integration tokens:", error.message);
    return [];
  }
  return (data as IntegrationToken[]) || [];
}

/**
 * Creates a new integration token. Returns the plaintext token ONCE.
 * The token is hashed with SHA-256 and only the hash is stored in DB.
 */
export async function createIntegrationToken(formData: {
  name: string;
}): Promise<{ data?: IntegrationTokenWithPlaintext; error?: string }> {
  const parsed = createTokenSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Data tidak valid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  // Generate a secure random token (32 bytes → 64 hex chars)
  const plainToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");

  const { data, error } = await supabase
    .from("integration_tokens")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      token_hash: tokenHash,
    })
    .select("id, user_id, name, created_at")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/work/settings");
  return {
    data: {
      ...(data as IntegrationToken),
      plain_token: plainToken,
    },
  };
}

export async function deleteIntegrationToken(id: string) {
  if (!id) return { error: "ID wajib diisi" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase.from("integration_tokens").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/work/settings");
  return { success: true };
}

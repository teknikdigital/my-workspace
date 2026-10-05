export type IntegrationProvider = "github" | "vercel" | "supabase" | "google" | "claude";
export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface Integration {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  is_enabled: boolean;
  status: IntegrationStatus;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // encrypted_config, iv, auth_tag are NEVER returned to client
}

export interface IntegrationToken {
  id: string;
  user_id: string;
  name: string;
  // token_hash is NEVER returned to client
  created_at: string;
}

export interface IntegrationTokenWithPlaintext extends IntegrationToken {
  /** Only available once, right after creation. Never stored in DB. */
  plain_token: string;
}

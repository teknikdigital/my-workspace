import { z } from "zod";

export const integrationProviders = [
  "github",
  "vercel",
  "supabase",
  "google",
  "claude",
] as const;

export type IntegrationProvider = (typeof integrationProviders)[number];

export const createIntegrationSchema = z.object({
  provider: z.enum(integrationProviders),
  is_enabled: z.boolean().default(false),
  config_value: z.string().min(1, "Nilai konfigurasi tidak boleh kosong").optional(),
});

export const updateIntegrationSchema = z.object({
  id: z.string().uuid(),
  is_enabled: z.boolean().optional(),
  config_value: z.string().min(1).optional(),
});

export const createTokenSchema = z.object({
  name: z.string().min(1, "Nama token tidak boleh kosong").max(100),
});

export const activityWebhookSchema = z.object({
  project: z.string().min(1, "Nama project wajib diisi"),
  activity_type: z
    .enum(["development", "bugfix", "deployment", "review", "documentation", "testing", "other"])
    .default("development"),
  summary: z.string().min(1, "Ringkasan aktivitas wajib diisi").max(1000),
  files_changed: z.array(z.string()).optional().default([]),
  status: z
    .enum(["in_progress", "completed", "blocked", "cancelled"])
    .default("completed"),
  source: z.enum(["claude", "github", "vercel", "ci", "external"]).default("claude"),
  application: z.string().optional(),
  task_id: z.string().uuid().optional(),
});

export type ActivityWebhookPayload = z.infer<typeof activityWebhookSchema>;

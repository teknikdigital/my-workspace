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
    .enum(["development", "bugfix", "deployment", "review", "documentation", "testing", "meeting", "planning", "configuration", "other"])
    .default("development"),
  summary: z.string().min(1, "Ringkasan aktivitas wajib diisi").max(1000),
  files_changed: z.array(z.string()).optional().default([]),
  status: z
    .enum(["in_progress", "completed", "blocked", "cancelled"])
    .default("completed"),
  // Bebas (huruf kecil/angka/-/_) agar alat apa pun bisa melapor: claude, claude-code, antigravity, git, ci, ...
  source: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,40}$/, "source hanya huruf kecil, angka, - atau _ (2-40 karakter)")
    .default("claude"),
  application: z.string().optional(),
  task_id: z.string().uuid().optional(),
  // Isi HANDOFF.md project (dikirim scripts/log-activity.mjs --handoff). Disimpan sebagai dokumen project.
  handoff: z
    .object({
      file_name: z.string().max(300).optional(),
      content: z.string().min(1, "Isi handoff kosong").max(400_000, "Handoff terlalu besar (maks 400 KB)"),
    })
    .optional(),
});

export type ActivityWebhookPayload = z.infer<typeof activityWebhookSchema>;

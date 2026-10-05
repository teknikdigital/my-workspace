import { z } from "zod";

export const applicationSchema = z.object({
  project_id: z.string().uuid("ID Project tidak valid").optional().nullable(),
  name: z.string().min(1, "Nama aplikasi wajib diisi").max(120),
  type: z.enum([
    "nextjs",
    "apps_script",
    "pwa",
    "streamlit",
    "static",
    "backend",
    "other",
  ]).default("other"),
  framework: z.string().optional().nullable(),
  production_url: z.string().url("URL produksi tidak valid").or(z.literal("")).optional().nullable(),
  staging_url: z.string().url("URL staging tidak valid").or(z.literal("")).optional().nullable(),
  status: z.enum([
    "planning",
    "development",
    "testing",
    "production",
    "maintenance",
    "archived",
  ]).default("development"),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

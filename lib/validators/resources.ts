import { z } from "zod";

export const resourceCategoryEnum = z.enum([
  "github",
  "supabase",
  "vercel",
  "apps_script",
  "google_sheet",
  "google_drive",
  "figma",
  "postman",
  "documentation",
  "production",
  "staging",
  "other",
]);

export const resourceSchema = z.object({
  title: z.string().min(1, "Judul resource wajib diisi").max(120),
  url: z
    .string()
    .url("Format URL tidak valid")
    .refine((val) => /^https?:\/\//i.test(val), {
      message: "URL hanya boleh menggunakan protokol http:// atau https://",
    }),
  category: resourceCategoryEnum.default("other"),
  account_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ResourceInput = z.infer<typeof resourceSchema>;

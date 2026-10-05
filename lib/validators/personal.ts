import { z } from "zod";

export const reminderSchema = z.object({
  title: z.string().min(1, "Judul pengingat wajib diisi").max(200),
  due_at: z.string().min(1, "Waktu pengingat wajib diisi"),
  source: z.string().default("manual"),
});

export const personalLinkSchema = z.object({
  title: z.string().min(1, "Judul link wajib diisi").max(120),
  url: z
    .string()
    .url("Format URL tidak valid")
    .refine((val) => /^https?:\/\//i.test(val), {
      message: "URL hanya boleh menggunakan protokol http:// atau https://",
    }),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
});

export const documentSchema = z.object({
  title: z.string().min(1, "Judul dokumen wajib diisi").max(150),
  file_path: z.string().min(1, "File path wajib diisi"),
  file_size: z.number().optional().nullable(),
  mime_type: z.string().optional().nullable(),
  category: z.string().default("general"),
});

export type ReminderInput = z.infer<typeof reminderSchema>;
export type PersonalLinkInput = z.infer<typeof personalLinkSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;

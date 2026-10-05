import { z } from "zod";

export const accountSchema = z.object({
  service_id: z.string().uuid().optional().nullable(),
  label: z.string().min(1, "Label akun wajib diisi").max(100),
  identifier: z.string().min(1, "Identifier (email/username) wajib diisi").max(120),
  notes: z.string().optional().nullable(),
  is_personal: z.boolean().default(false),
});

export type AccountInput = z.infer<typeof accountSchema>;

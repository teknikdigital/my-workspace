import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().min(1, "Nama project wajib diisi").max(120),
  description: z.string().optional().nullable(),
  status: z.enum([
    "planning",
    "development",
    "testing",
    "production",
    "maintenance",
    "archived",
  ]).default("planning"),
  progress: z.number().int().min(0).max(100).default(0),
  category: z.string().optional().nullable(),
  tech_stack: z.array(z.string()).default([]),
});

export type ProjectInput = z.infer<typeof projectSchema>;

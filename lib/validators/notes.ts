import { z } from "zod";

export const noteSchema = z.object({
  title: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  project_id: z.string().uuid().optional().nullable(),
  application_id: z.string().uuid().optional().nullable(),
  is_pinned: z.boolean().optional(),
  scope: z.enum(["personal", "work", "project"]).optional(),
});

export type NoteInput = z.infer<typeof noteSchema>;

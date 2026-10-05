import { z } from "zod";

export const noteSchema = z.object({
  title: z.string().optional().nullable(),
  body: z.string().min(1, "Isi catatan tidak boleh kosong"),
  scope: z.enum(["personal", "work", "project"]).default("work"),
});

export type NoteInput = z.infer<typeof noteSchema>;

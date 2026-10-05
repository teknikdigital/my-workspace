import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(1, "Judul task wajib diisi").max(200),
  description: z.string().optional().nullable(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  due_date: z.string().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  application_id: z.string().uuid().optional().nullable(),
  source: z.enum(["manual", "ai", "claude", "whatsapp", "activity"]).default("manual"),
});

export type TaskInput = z.infer<typeof taskSchema>;

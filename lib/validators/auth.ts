import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Format email tidak valid").min(1, "Email wajib diisi"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
  next: z.string().optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

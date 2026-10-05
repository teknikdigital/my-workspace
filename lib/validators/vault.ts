import { z } from "zod";

export const credentialTypeEnum = z.enum([
  "password",
  "api_key",
  "token",
  "service_role_key",
  "recovery_code",
  "secret",
]);

export const credentialSchema = z.object({
  service_id: z.string().uuid().optional().nullable(),
  label: z.string().min(1, "Label kredensial wajib diisi").max(100),
  identifier: z.string().optional().nullable(),
  credential_type: credentialTypeEnum.default("secret"),
  secret_value: z.string().min(1, "Nilai rahasia / secret wajib diisi"),
  notes: z.string().optional().nullable(),
});

export const revealCredentialSchema = z.object({
  credential_id: z.string().uuid("ID Kredensial tidak valid"),
  auth_password: z.string().min(1, "Kata sandi akun wajib diisi untuk verifikasi keamanan"),
  action: z.enum(["reveal", "copy"]).default("reveal"),
});

export type CredentialInput = z.infer<typeof credentialSchema>;
export type RevealCredentialInput = z.infer<typeof revealCredentialSchema>;

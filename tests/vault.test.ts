import { describe, it, expect, beforeAll } from "vitest";
import { encryptVaultValue, decryptVaultValue } from "@/lib/vault/crypto";

describe("Vault AES-256-GCM Encryption", () => {
  beforeAll(() => {
    // Set dummy 32-byte encryption key for testing
    process.env.VAULT_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("encrypts and decrypts secret value correctly", () => {
    const originalSecret = "sk-ant-api03-my-super-secret-key-123456789";
    const encrypted = encryptVaultValue(originalSecret);

    expect(encrypted.encryptedValue).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.authTag).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(encrypted.encryptedValue).not.toContain(originalSecret);

    const decrypted = decryptVaultValue(
      encrypted.encryptedValue,
      encrypted.iv,
      encrypted.authTag
    );
    expect(decrypted).toBe(originalSecret);
  });

  it("fails decryption when ciphertext or auth tag is tampered", () => {
    const originalSecret = "password-rahasia-123";
    const encrypted = encryptVaultValue(originalSecret);

    // Tamper the ciphertext
    // ganti karakter pertama dengan nilai yang PASTI berbeda (bukan selalu "a": bisa sama dengan aslinya)
    const first = encrypted.encryptedValue[0];
    const tampered = (first === "a" ? "b" : "a") + encrypted.encryptedValue.slice(1);
    expect(() =>
      decryptVaultValue(tampered, encrypted.iv, encrypted.authTag)
    ).toThrow();
  });
});

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes for GCM

function getEncryptionKey(): Buffer {
  const envKey = process.env.VAULT_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error("VAULT_ENCRYPTION_KEY is not configured in environment variables.");
  }

  // If provided as 64 hex characters (32 bytes), parse it directly
  if (/^[0-9a-fA-F]{64}$/.test(envKey.trim())) {
    return Buffer.from(envKey.trim(), "hex");
  }

  // Otherwise derive 32 bytes using SHA-256
  return crypto.createHash("sha256").update(envKey.trim()).digest();
}

export interface EncryptedPayload {
  encryptedValue: string; // hex
  iv: string;             // hex
  authTag: string;        // hex
}

export function encryptVaultValue(plainText: string): EncryptedPayload {
  if (!plainText) {
    throw new Error("Cannot encrypt empty value");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedValue: encrypted,
    iv: iv.toString("hex"),
    authTag,
  };
}

export function decryptVaultValue(
  encryptedHex: string,
  ivHex: string,
  authTagHex: string
): string {
  if (!encryptedHex || !ivHex || !authTagHex) {
    throw new Error("Invalid encrypted payload");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

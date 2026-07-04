/**
 * Field-level AES-256-GCM encryption for the most sensitive PII
 * (SSN, EIN, bank details) — spec T1.4 / GLBA Safeguards.
 *
 * Values are encrypted in the application before they reach Postgres, so a
 * database dump exposes only ciphertext. The data-encryption key comes from
 * the SecretsProvider (FIELD_ENCRYPTION_KEY, 32 bytes base64) — in production
 * that means Vault; the key never lives in the schema or the DB.
 *
 * Wire format: v1:<base64 iv>:<base64 ciphertext+authTag>
 * The version prefix allows future key rotation / algorithm migration.
 */

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const VERSION = "v1";
const IV_LENGTH = 12; // GCM standard nonce size
const AUTH_TAG_LENGTH = 16;

export function parseFieldKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  }
  return key;
}

export function generateFieldKey(): string {
  return randomBytes(32).toString("base64");
}

export function encryptField(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tagged = Buffer.concat([ciphertext, cipher.getAuthTag()]);
  return `${VERSION}:${iv.toString("base64")}:${tagged.toString("base64")}`;
}

export function decryptField(encoded: string, key: Buffer): string {
  const [version, ivB64, taggedB64] = encoded.split(":");
  if (version !== VERSION || !ivB64 || !taggedB64) {
    throw new Error("Malformed encrypted field");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tagged = Buffer.from(taggedB64, "base64");
  if (tagged.length < AUTH_TAG_LENGTH) {
    throw new Error("Malformed encrypted field");
  }
  const ciphertext = tagged.subarray(0, tagged.length - AUTH_TAG_LENGTH);
  const authTag = tagged.subarray(tagged.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function isEncryptedField(value: string): boolean {
  return value.startsWith(`${VERSION}:`);
}

/**
 * Binary variants for the document vault (T4.1). Output layout:
 * [12-byte IV][ciphertext][16-byte auth tag]. Encrypted with a per-user
 * key derived below, so one user's key can never open another's blobs.
 */
export function encryptBytes(plaintext: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
}

export function decryptBytes(blob: Buffer, key: Buffer): Buffer {
  if (blob.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Malformed encrypted blob");
  }
  const iv = blob.subarray(0, IV_LENGTH);
  const authTag = blob.subarray(blob.length - AUTH_TAG_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH, blob.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** HKDF-SHA256 per-user key derivation from the master field key. */
export function deriveUserKey(masterKey: Buffer, userId: string, info = "vault"): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey, Buffer.from(userId), Buffer.from(info), 32));
}

/** Constant-time string comparison for tokens/OTPs. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

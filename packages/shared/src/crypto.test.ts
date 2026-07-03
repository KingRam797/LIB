import { describe, expect, it } from "vitest";
import {
  decryptField,
  encryptField,
  generateFieldKey,
  isEncryptedField,
  parseFieldKey,
  safeEqual,
} from "./crypto.js";

describe("field-level encryption (AES-256-GCM)", () => {
  const key = parseFieldKey(generateFieldKey());

  it("round-trips plaintext", () => {
    const encrypted = encryptField("123-45-6789", key);
    expect(decryptField(encrypted, key)).toBe("123-45-6789");
  });

  it("produces ciphertext, not plaintext, at rest", () => {
    const encrypted = encryptField("123-45-6789", key);
    expect(encrypted).not.toContain("123-45-6789");
    expect(isEncryptedField(encrypted)).toBe(true);
  });

  it("uses a fresh IV per encryption", () => {
    const a = encryptField("same", key);
    const b = encryptField("same", key);
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext (auth tag)", () => {
    const encrypted = encryptField("secret", key);
    const parts = encrypted.split(":");
    const tampered = Buffer.from(parts[2]!, "base64");
    tampered[0] = tampered[0]! ^ 0xff;
    const forged = `${parts[0]}:${parts[1]}:${tampered.toString("base64")}`;
    expect(() => decryptField(forged, key)).toThrow();
  });

  it("rejects the wrong key", () => {
    const encrypted = encryptField("secret", key);
    const otherKey = parseFieldKey(generateFieldKey());
    expect(() => decryptField(encrypted, otherKey)).toThrow();
  });

  it("rejects malformed keys", () => {
    expect(() => parseFieldKey("dG9vc2hvcnQ=")).toThrow();
  });
});

describe("safeEqual", () => {
  it("compares equal strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });
  it("rejects different strings and lengths", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

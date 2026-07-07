/**
 * T1.1 — JWT access tokens + rotating opaque refresh tokens.
 *
 * Refresh tokens are 256-bit random values stored only as SHA-256 hashes.
 * Each refresh rotates the token within a family; presenting an
 * already-used token is treated as theft and revokes the whole family.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@spendwhere/shared";
import type { Db } from "../db/client.js";
import { refreshTokens } from "../db/schema.js";

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  /** true when this session proved MFA (TOTP at login). */
  mfa: boolean;
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  secret: Uint8Array,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({ role: claims.role, mfa: claims.mfa })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("spendwhere-api")
    .setAudience("spendwhere")
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
  secret: Uint8Array,
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: "spendwhere-api",
    audience: "spendwhere",
  });
  if (typeof payload.sub !== "string") throw new Error("Missing sub");
  return {
    sub: payload.sub,
    role: (payload["role"] as Role) ?? "user",
    mfa: payload["mfa"] === true,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedRefreshToken {
  token: string;
  familyId: string;
}

export async function issueRefreshToken(
  db: Db,
  userId: string,
  ttlSeconds: number,
  mfaVerified: boolean,
  familyId: string = randomUUID(),
): Promise<IssuedRefreshToken> {
  const token = randomBytes(32).toString("hex");
  await db.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: hashToken(token),
    mfaVerified,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  });
  return { token, familyId };
}

export class RefreshTokenError extends Error {
  constructor(
    message: string,
    public readonly reason: "invalid" | "expired" | "reused" | "revoked",
    /** Set for "reused" so the caller can revoke the family in a fresh transaction. */
    public readonly familyId?: string,
  ) {
    super(message);
  }
}

export interface RotationResult {
  userId: string;
  mfaVerified: boolean;
  newToken: string;
  familyId: string;
}

export async function rotateRefreshToken(
  db: Db,
  presentedToken: string,
  ttlSeconds: number,
): Promise<RotationResult> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(presentedToken)))
    .limit(1);

  if (!row) throw new RefreshTokenError("Unknown refresh token", "invalid");
  if (row.revokedAt) throw new RefreshTokenError("Refresh token revoked", "revoked");
  if (row.usedAt) {
    // Reuse detected. The throw aborts this transaction, so the caller must
    // revoke the family in a fresh one (see /auth/refresh).
    throw new RefreshTokenError("Refresh token reuse detected", "reused", row.familyId);
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw new RefreshTokenError("Refresh token expired", "expired");
  }

  await db
    .update(refreshTokens)
    .set({ usedAt: new Date() })
    .where(eq(refreshTokens.id, row.id));

  const issued = await issueRefreshToken(db, row.userId, ttlSeconds, row.mfaVerified, row.familyId);
  return {
    userId: row.userId,
    mfaVerified: row.mfaVerified,
    newToken: issued.token,
    familyId: row.familyId,
  };
}

export async function revokeFamily(db: Db, familyId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

export async function revokeByToken(db: Db, presentedToken: string): Promise<void> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(presentedToken)))
    .limit(1);
  if (row) await revokeFamily(db, row.familyId);
}

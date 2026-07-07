import type { FastifyReply, FastifyRequest } from "fastify";
import type { AccessTokenClaims } from "../auth/tokens.js";
import { verifyAccessToken } from "../auth/tokens.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AccessTokenClaims;
  }
}

export function makeRequireAuth(jwtSecret: Uint8Array) {
  return async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing bearer token" });
    }
    try {
      req.auth = await verifyAccessToken(header.slice("Bearer ".length), jwtSecret);
    } catch {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }
  };
}

/**
 * T1.2 — step-up gate for sensitive actions. If the account has MFA
 * enabled, the current session must have proven TOTP at login.
 */
export function requireMfaVerified(mfaEnabled: boolean, claims: AccessTokenClaims): boolean {
  return !mfaEnabled || claims.mfa;
}

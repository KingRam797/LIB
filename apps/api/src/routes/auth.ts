import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  decryptField,
  encryptField,
  LoginInput,
  RegisterInput,
} from "@spendwhere/shared";
import { appendAudit } from "../audit.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import {
  issueRefreshToken,
  RefreshTokenError,
  revokeByToken,
  revokeFamily,
  rotateRefreshToken,
  signAccessToken,
} from "../auth/tokens.js";
import { generateTotpSecret, totpUri, verifyTotp } from "../auth/totp.js";
import { users } from "../db/schema.js";
import { makeRequireAuth } from "../plugins/auth-guard.js";
import { toPublicUser, type AppContext } from "../context.js";

const RefreshInput = z.object({ refreshToken: z.string().min(32).max(512) });
const TotpCodeInput = z.object({ code: z.string().length(6).regex(/^\d+$/) });

export async function authRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, db } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  async function issueSession(userId: string, role: "user" | "admin", mfa: boolean) {
    const accessToken = await signAccessToken(
      { sub: userId, role, mfa },
      config.jwtSecret,
      config.accessTokenTtlSeconds,
    );
    const refresh = await db.withAuthDb((tx) =>
      issueRefreshToken(tx, userId, config.refreshTokenTtlSeconds, mfa),
    );
    return {
      accessToken,
      refreshToken: refresh.token,
      accessTokenExpiresIn: config.accessTokenTtlSeconds,
    };
  }

  // Tight rate limits on credential endpoints (T0.5).
  const credentialLimits = {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  };

  app.post("/auth/register", credentialLimits, async (req, reply) => {
    const parsed = RegisterInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", detail: parsed.error.flatten() });
    }
    const { email, password, displayName } = parsed.data;
    const passwordHash = await hashPassword(password);

    try {
      const user = await db.withAuthDb(async (tx) => {
        const [row] = await tx
          .insert(users)
          .values({ email: email.toLowerCase(), displayName, passwordHash })
          .returning();
        return row!;
      });
      await appendAudit(db.pool, {
        actorUserId: user.id,
        action: "auth.register",
        resource: `user:${user.id}`,
      });
      const tokens = await issueSession(user.id, user.role, false);
      return reply.code(201).send({ user: toPublicUser(user), ...tokens });
    } catch (err) {
      // drizzle wraps the pg error; the SQLSTATE may live on err or err.cause.
      const e = err as { code?: string; cause?: { code?: string } };
      if (e.code === "23505" || e.cause?.code === "23505") {
        return reply.code(409).send({ error: "Email already registered" });
      }
      throw err;
    }
  });

  app.post("/auth/login", credentialLimits, async (req, reply) => {
    const parsed = LoginInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    const { email, password, totpCode } = parsed.data;

    const user = await db.withAuthDb(async (tx) => {
      const [row] = await tx
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);
      return row;
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await appendAudit(db.pool, {
        actorUserId: user?.id ?? null,
        action: "auth.login.failed",
        resource: `email:${email.toLowerCase()}`,
        detail: { reason: "bad_credentials" },
      });
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    let mfa = false;
    if (user.mfaEnabled) {
      if (!totpCode) {
        return reply.code(401).send({ error: "TOTP code required", mfaRequired: true });
      }
      const secret = decryptField(user.totpSecretEnc!, config.fieldKey);
      if (!verifyTotp(totpCode, secret)) {
        await appendAudit(db.pool, {
          actorUserId: user.id,
          action: "auth.login.failed",
          resource: `user:${user.id}`,
          detail: { reason: "bad_totp" },
        });
        return reply.code(401).send({ error: "Invalid TOTP code" });
      }
      mfa = true;
    }

    await appendAudit(db.pool, {
      actorUserId: user.id,
      action: "auth.login",
      resource: `user:${user.id}`,
      detail: { mfa },
    });
    const tokens = await issueSession(user.id, user.role, mfa);
    return reply.send({ user: toPublicUser(user), ...tokens });
  });

  app.post("/auth/refresh", credentialLimits, async (req, reply) => {
    const parsed = RefreshInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    try {
      const rotation = await db.withAuthDb((tx) =>
        rotateRefreshToken(tx, parsed.data.refreshToken, config.refreshTokenTtlSeconds),
      );
      const user = await db.withAuthDb(async (tx) => {
        const [row] = await tx.select().from(users).where(eq(users.id, rotation.userId)).limit(1);
        return row!;
      });
      const accessToken = await signAccessToken(
        { sub: user.id, role: user.role, mfa: rotation.mfaVerified },
        config.jwtSecret,
        config.accessTokenTtlSeconds,
      );
      return reply.send({
        accessToken,
        refreshToken: rotation.newToken,
        accessTokenExpiresIn: config.accessTokenTtlSeconds,
      });
    } catch (err) {
      if (err instanceof RefreshTokenError) {
        if (err.reason === "reused" && err.familyId) {
          // The rotation transaction rolled back; revoke the family here.
          await db.withAuthDb((tx) => revokeFamily(tx, err.familyId!));
          await appendAudit(db.pool, {
            action: "auth.refresh.reuse_detected",
            resource: `refresh_family:${err.familyId}`,
          });
        }
        return reply.code(401).send({ error: "Invalid refresh token" });
      }
      throw err;
    }
  });

  app.post("/auth/logout", async (req, reply) => {
    const parsed = RefreshInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    await db.withAuthDb((tx) => revokeByToken(tx, parsed.data.refreshToken));
    return reply.send({ ok: true });
  });

  // --- MFA (T1.2) ---

  app.post("/auth/mfa/enroll", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const secret = generateTotpSecret();
    const user = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .update(users)
        .set({ totpSecretEnc: encryptField(secret, config.fieldKey), mfaEnabled: false })
        .where(eq(users.id, userId))
        .returning();
      return row!;
    });
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "auth.mfa.enroll_started",
      resource: `user:${userId}`,
    });
    return reply.send({ otpauthUri: totpUri(user.email, secret) });
  });

  app.post("/auth/mfa/verify", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = TotpCodeInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const userId = req.auth!.sub;

    const user = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      return row;
    });
    if (!user?.totpSecretEnc) {
      return reply.code(400).send({ error: "No MFA enrollment in progress" });
    }
    const secret = decryptField(user.totpSecretEnc, config.fieldKey);
    if (!verifyTotp(parsed.data.code, secret)) {
      return reply.code(401).send({ error: "Invalid TOTP code" });
    }
    await db.withUserDb(userId, (tx) =>
      tx.update(users).set({ mfaEnabled: true }).where(eq(users.id, userId)),
    );
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "auth.mfa.enabled",
      resource: `user:${userId}`,
    });
    // Upgrade the session: caller re-logs or uses this fresh token pair.
    const tokens = await issueSession(userId, user.role, true);
    return reply.send({ ok: true, ...tokens });
  });

  app.post("/auth/mfa/disable", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = TotpCodeInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const userId = req.auth!.sub;
    const user = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      return row;
    });
    if (!user?.mfaEnabled || !user.totpSecretEnc) {
      return reply.code(400).send({ error: "MFA is not enabled" });
    }
    const secret = decryptField(user.totpSecretEnc, config.fieldKey);
    if (!verifyTotp(parsed.data.code, secret)) {
      return reply.code(401).send({ error: "Invalid TOTP code" });
    }
    await db.withUserDb(userId, (tx) =>
      tx
        .update(users)
        .set({ mfaEnabled: false, totpSecretEnc: null })
        .where(eq(users.id, userId)),
    );
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "auth.mfa.disabled",
      resource: `user:${userId}`,
    });
    return reply.send({ ok: true });
  });
}

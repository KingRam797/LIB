import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { decryptField, encryptField } from "@spendwhere/shared";
import { appendAudit } from "../audit.js";
import { sensitiveProfiles, users } from "../db/schema.js";
import { makeRequireAuth, requireMfaVerified } from "../plugins/auth-guard.js";
import { toPublicUser, type AppContext } from "../context.js";

const SensitiveInput = z.object({
  ssn: z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/).optional(),
  ein: z.string().regex(/^\d{2}-?\d{7}$/).optional(),
  bankRouting: z.string().regex(/^\d{9}$/).optional(),
  bankAccount: z.string().regex(/^\d{4,17}$/).optional(),
});

function maskTail(value: string, visible = 4): string {
  const digits = value.replaceAll("-", "");
  return `${"•".repeat(Math.max(0, digits.length - visible))}${digits.slice(-visible)}`;
}

export async function meRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, db } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  app.get("/me", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const user = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      return row;
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    return reply.send({ user: toPublicUser(user) });
  });

  // Sensitive PII endpoints (T1.4). MFA step-up enforced (T1.2); every
  // access is audit-logged (T1.6).
  app.get("/me/sensitive", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const user = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      return row;
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    if (!requireMfaVerified(user.mfaEnabled, req.auth!)) {
      return reply.code(403).send({ error: "MFA verification required for this action" });
    }

    const profile = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .select()
        .from(sensitiveProfiles)
        .where(eq(sensitiveProfiles.userId, userId))
        .limit(1);
      return row;
    });

    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "pii.read",
      resource: `sensitive_profile:${userId}`,
      detail: {
        fields: profile
          ? Object.entries({
              ssn: profile.ssnEnc,
              ein: profile.einEnc,
              bankRouting: profile.bankRoutingEnc,
              bankAccount: profile.bankAccountEnc,
            })
              .filter(([, v]) => v)
              .map(([k]) => k)
          : [],
      },
    });

    if (!profile) return reply.send({ profile: null });
    const decryptMasked = (enc: string | null) =>
      enc ? maskTail(decryptField(enc, config.fieldKey)) : null;
    return reply.send({
      profile: {
        ssn: decryptMasked(profile.ssnEnc),
        ein: decryptMasked(profile.einEnc),
        bankRouting: decryptMasked(profile.bankRoutingEnc),
        bankAccount: decryptMasked(profile.bankAccountEnc),
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
  });

  app.put("/me/sensitive", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = SensitiveInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", detail: parsed.error.flatten() });
    }
    const userId = req.auth!.sub;
    const user = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      return row;
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    if (!requireMfaVerified(user.mfaEnabled, req.auth!)) {
      return reply.code(403).send({ error: "MFA verification required for this action" });
    }

    const { ssn, ein, bankRouting, bankAccount } = parsed.data;
    const enc = (v: string | undefined) =>
      v === undefined ? undefined : encryptField(v, config.fieldKey);

    await db.withUserDb(userId, async (tx) => {
      const values = {
        userId,
        ssnEnc: enc(ssn),
        einEnc: enc(ein),
        bankRoutingEnc: enc(bankRouting),
        bankAccountEnc: enc(bankAccount),
        updatedAt: new Date(),
      };
      await tx
        .insert(sensitiveProfiles)
        .values(values)
        .onConflictDoUpdate({
          target: sensitiveProfiles.userId,
          set: Object.fromEntries(
            Object.entries({
              ssnEnc: values.ssnEnc,
              einEnc: values.einEnc,
              bankRoutingEnc: values.bankRoutingEnc,
              bankAccountEnc: values.bankAccountEnc,
              updatedAt: values.updatedAt,
            }).filter(([, v]) => v !== undefined),
          ),
        });
    });

    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "pii.write",
      resource: `sensitive_profile:${userId}`,
      detail: {
        fields: Object.entries({ ssn, ein, bankRouting, bankAccount })
          .filter(([, v]) => v !== undefined)
          .map(([k]) => k),
      },
    });
    return reply.send({ ok: true });
  });
}

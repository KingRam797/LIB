import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { appendAudit } from "../audit.js";
import { verifyPassword } from "../auth/passwords.js";
import {
  budgetTransactions,
  complianceEvents,
  documents,
  investmentSchedules,
  kycInquiries,
  lessonProgress,
  llcProfiles,
  notifications,
  onboardingProfiles,
  users,
} from "../db/schema.js";
import { makeRequireAuth, requireMfaVerified } from "../plugins/auth-guard.js";
import type { BlobStorage } from "../vault/storage.js";
import type { AppContext } from "../context.js";

/**
 * T4.4 — data-subject rights (CCPA-ready): full export and account deletion.
 * Audit-log entries are retained after deletion — they are security records
 * required for GLBA Safeguards accountability, disclosed in the export.
 */
export async function privacyRoutes(
  app: FastifyInstance,
  ctx: AppContext & { storage: BlobStorage },
): Promise<void> {
  const { config, db, storage } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  app.get("/me/export", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;

    const data = await db.withUserDb(userId, async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return null;
      const pick = async <T>(q: Promise<T>) => q;
      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
          kycStatus: user.kycStatus,
          createdAt: user.createdAt,
        },
        onboarding: await pick(
          tx.select().from(onboardingProfiles).where(eq(onboardingProfiles.userId, userId)),
        ),
        lessonProgress: await pick(
          tx.select().from(lessonProgress).where(eq(lessonProgress.userId, userId)),
        ),
        investmentSchedules: await pick(
          tx.select().from(investmentSchedules).where(eq(investmentSchedules.userId, userId)),
        ),
        budgetTransactions: await pick(
          tx.select().from(budgetTransactions).where(eq(budgetTransactions.userId, userId)),
        ),
        llcProfile: await pick(
          tx.select().from(llcProfiles).where(eq(llcProfiles.userId, userId)),
        ),
        kycInquiries: await pick(
          tx.select().from(kycInquiries).where(eq(kycInquiries.userId, userId)),
        ),
        documents: await pick(
          tx
            .select({
              id: documents.id,
              filename: documents.filename,
              contentType: documents.contentType,
              sizeBytes: documents.sizeBytes,
              category: documents.category,
              tags: documents.tags,
              createdAt: documents.createdAt,
            })
            .from(documents)
            .where(eq(documents.userId, userId)),
        ),
        complianceEvents: await pick(
          tx.select().from(complianceEvents).where(eq(complianceEvents.userId, userId)),
        ),
        notifications: await pick(
          tx.select().from(notifications).where(eq(notifications.userId, userId)),
        ),
      };
    });
    if (!data) return reply.code(404).send({ error: "User not found" });

    // Audit entries about this user (retained security records).
    const audit = await db.pool.query(
      "SELECT occurred_at, action, resource, detail FROM audit_log WHERE actor_user_id = $1 ORDER BY id ASC",
      [userId],
    );

    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "privacy.export",
      resource: `user:${userId}`,
    });

    return reply
      .header("content-disposition", 'attachment; filename="spendwhere-export.json"')
      .send({
        exportedAt: new Date().toISOString(),
        note:
          "Vault document contents are downloadable individually via /vault/documents/:id/download. " +
          "Sensitive fields (SSN/EIN/bank) are excluded from this export by design; view them in-app. " +
          "Audit entries are security records retained even after account deletion.",
        ...data,
        auditTrail: audit.rows,
      });
  });

  const DeleteInput = z.object({ password: z.string().min(1).max(1024) });

  app.post("/me/delete", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = DeleteInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const userId = req.auth!.sub;

    const user = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      return row;
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    if (!requireMfaVerified(user.mfaEnabled, req.auth!)) {
      return reply.code(403).send({ error: "MFA verification required for this action" });
    }
    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: "Password incorrect" });
    }

    // Remove vault blobs first (DB rows cascade with the user row).
    const docs = await db.withUserDb(userId, (tx) =>
      tx.select().from(documents).where(eq(documents.userId, userId)),
    );
    for (const doc of docs) {
      await storage.delete(doc.storageKey);
    }

    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "privacy.account_deleted",
      resource: `user:${userId}`,
      detail: { documentsDeleted: docs.length },
    });

    await db.withUserDb(userId, (tx) => tx.delete(users).where(eq(users.id, userId)));
    return reply.send({ ok: true, deleted: true });
  });
}

import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { appendAudit } from "../audit.js";
import { kycInquiries, users } from "../db/schema.js";
import { makeRequireAuth } from "../plugins/auth-guard.js";
import type { AppContext } from "../context.js";

const WebhookOutcome = z.enum(["passed", "failed"]);

export async function kycRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, db, kyc } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  app.post("/kyc/start", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const user = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      return row;
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    if (user.kycStatus === "passed") {
      return reply.code(409).send({ error: "KYC already passed" });
    }

    const inquiry = await kyc.createInquiry(userId);
    await db.withUserDb(userId, async (tx) => {
      await tx.insert(kycInquiries).values({ userId, inquiryId: inquiry.inquiryId });
      await tx.update(users).set({ kycStatus: "pending" }).where(eq(users.id, userId));
    });
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "kyc.started",
      resource: `kyc_inquiry:${inquiry.inquiryId}`,
      detail: { stub: inquiry.stub },
    });
    return reply.code(201).send({
      inquiryId: inquiry.inquiryId,
      sessionUrl: inquiry.sessionUrl ?? null,
      stub: inquiry.stub,
    });
  });

  async function applyOutcome(inquiryId: string, outcome: "passed" | "failed"): Promise<boolean> {
    return db.withAuthDb(async (tx) => {
      const [inquiry] = await tx
        .select()
        .from(kycInquiries)
        .where(eq(kycInquiries.inquiryId, inquiryId))
        .limit(1);
      if (!inquiry) return false;
      await tx
        .update(kycInquiries)
        .set({ status: outcome, updatedAt: new Date() })
        .where(eq(kycInquiries.id, inquiry.id));
      await tx.update(users).set({ kycStatus: outcome }).where(eq(users.id, inquiry.userId));
      return true;
    });
  }

  // Persona webhook (real mode): signature-verified against the raw body,
  // status/token only stored. Registered in an encapsulated scope whose JSON
  // parser preserves the raw string so the HMAC is byte-accurate.
  await app.register(async (scope) => {
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_req, body, done) => done(null, body),
    );
    scope.post("/kyc/webhook", async (req, reply) => {
      const rawBody = req.body as string;
      const signature = req.headers["persona-signature"] as string | undefined;
      if (!kyc.verifyWebhookSignature(rawBody, signature)) {
        return reply.code(401).send({ error: "Invalid webhook signature" });
      }
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return reply.code(400).send({ error: "Malformed webhook" });
      }
      const parsed = z
        .object({
          data: z.object({
            attributes: z.object({
              payload: z.object({
                data: z.object({
                  id: z.string(),
                  attributes: z.object({ status: z.string() }),
                }),
              }),
            }),
          }),
        })
        .safeParse(json);
      if (!parsed.success) return reply.code(400).send({ error: "Malformed webhook" });

      const inquiry = parsed.data.data.attributes.payload.data;
      const status = inquiry.attributes.status;
      const outcome =
        status === "completed" || status === "approved"
          ? ("passed" as const)
          : status === "failed" || status === "declined"
            ? ("failed" as const)
            : null;
      if (outcome) {
        const found = await applyOutcome(inquiry.id, outcome);
        if (found) {
          await appendAudit(db.pool, {
            action: `kyc.${outcome}`,
            resource: `kyc_inquiry:${inquiry.id}`,
            detail: { via: "webhook" },
          });
        }
      }
      return reply.send({ ok: true });
    });
  });

  // Dev/test-only completion hook so the KYC gate is exercisable in stub mode.
  if (config.nodeEnv !== "production") {
    app.post("/kyc/dev/complete", async (req, reply) => {
      const parsed = z
        .object({ inquiryId: z.string(), outcome: WebhookOutcome })
        .safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
      const found = await applyOutcome(parsed.data.inquiryId, parsed.data.outcome);
      if (!found) return reply.code(404).send({ error: "Unknown inquiry" });
      await appendAudit(db.pool, {
        action: `kyc.${parsed.data.outcome}`,
        resource: `kyc_inquiry:${parsed.data.inquiryId}`,
        detail: { via: "dev_complete" },
      });
      return reply.send({ ok: true });
    });
  }
}

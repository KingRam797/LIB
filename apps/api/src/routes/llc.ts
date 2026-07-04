import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { appendAudit } from "../audit.js";
import { ensureLlcEvents } from "../calendar/events.js";
import { llcProfiles } from "../db/schema.js";
import {
  articlesOfOrganization,
  LEGAL_DISCLAIMER,
  missingArticlesFields,
  operatingAgreement,
  residentAgentGuide,
  ss4Summary,
  type GeneratedDoc,
  type LlcData,
} from "../llc/documents.js";
import { checkName } from "../llc/name-check.js";
import { makeRequireAuth } from "../plugins/auth-guard.js";
import type { AppContext } from "../context.js";

const ProfileInput = z.object({
  entityName: z.string().min(1).max(200).optional(),
  purpose: z.string().min(1).max(2000).optional(),
  duration: z.string().min(1).max(100).optional(),
  residentAgentName: z.string().min(1).max(200).optional(),
  registeredOfficeStreet: z.string().min(1).max(300).optional(),
  registeredOfficeCity: z.string().min(1).max(100).optional(),
  registeredOfficeZip: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  mailingStreet: z.string().max(300).optional(),
  mailingCity: z.string().max(100).optional(),
  mailingZip: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  organizerName: z.string().min(1).max(200).optional(),
  organizerAddress: z.string().max(400).optional(),
  management: z.enum(["member_managed", "manager_managed"]).optional(),
  memberNames: z.array(z.string().min(1).max(200)).max(50).optional(),
  formedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  responsiblePartyName: z.string().max(200).optional(),
  principalActivity: z.string().max(300).optional(),
  expectedEmployees: z.number().int().min(0).max(100000).optional(),
  businessStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type ProfileRow = typeof llcProfiles.$inferSelect;

function toLlcData(row: ProfileRow): Partial<LlcData> & { purpose: string; duration: string } {
  return {
    entityName: row.entityName ?? undefined,
    purpose: row.purpose,
    duration: row.duration,
    residentAgentName: row.residentAgentName ?? undefined,
    registeredOfficeStreet: row.registeredOfficeStreet ?? undefined,
    registeredOfficeCity: row.registeredOfficeCity ?? undefined,
    registeredOfficeZip: row.registeredOfficeZip ?? undefined,
    organizerName: row.organizerName ?? undefined,
    organizerAddress: row.organizerAddress,
    management: row.management,
    memberNames: (row.memberNames as string[]) ?? [],
    responsiblePartyName: row.responsiblePartyName,
    principalActivity: row.principalActivity,
    expectedEmployees: row.expectedEmployees,
    businessStartDate: row.businessStartDate,
  };
}

export async function llcRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, db } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  async function getProfile(userId: string): Promise<ProfileRow | null> {
    return db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .select()
        .from(llcProfiles)
        .where(eq(llcProfiles.userId, userId))
        .limit(1);
      return row ?? null;
    });
  }

  app.get("/llc/profile", { preHandler: requireAuth }, async (req, reply) => {
    const profile = await getProfile(req.auth!.sub);
    return reply.send({
      profile,
      readiness: {
        articlesMissingFields: missingArticlesFields(profile ? toLlcData(profile) : {}),
      },
    });
  });

  app.put("/llc/profile", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = ProfileInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", detail: parsed.error.flatten() });
    }
    const userId = req.auth!.sub;
    const set = { ...parsed.data, updatedAt: new Date() };
    const profile = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .insert(llcProfiles)
        .values({ userId, ...set })
        .onConflictDoUpdate({ target: llcProfiles.userId, set })
        .returning();
      return row!;
    });
    if (parsed.data.formedOn) {
      // T4.3 — recording the LARA filing date auto-populates the compliance
      // calendar (MI Annual Statement + estimated-tax deadlines).
      await db.withUserDb(userId, (tx) => ensureLlcEvents(tx, userId, parsed.data.formedOn!));
      await appendAudit(db.pool, {
        actorUserId: userId,
        action: "llc.formed_recorded",
        resource: `llc_profile:${userId}`,
        detail: { formedOn: parsed.data.formedOn },
      });
    }
    return reply.send({
      profile,
      readiness: { articlesMissingFields: missingArticlesFields(toLlcData(profile)) },
    });
  });

  // T3.1 — name availability signal + authoritative search links.
  app.post("/llc/name-check", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = z.object({ name: z.string().min(1).max(300) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    return reply.send(checkName(parsed.data.name));
  });

  // --- Document generation (T3.2–T3.5) ---

  function sendPdf(reply: FastifyReply, doc: GeneratedDoc, filename: string) {
    return reply
      .header("content-type", "application/pdf")
      .header("content-disposition", `attachment; filename="${filename}"`)
      .header("x-spendwhere-disclaimer", "not-legal-advice")
      .send(Buffer.from(doc.pdf));
  }

  app.get("/llc/documents/articles.pdf", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const profile = await getProfile(userId);
    const data = profile ? toLlcData(profile) : {};
    const missing = missingArticlesFields(data);
    if (!profile || missing.length > 0) {
      return reply.code(422).send({
        error: "LLC profile incomplete for Articles of Organization",
        missingFields: missing,
      });
    }
    const doc = await articlesOfOrganization(data as LlcData);
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "llc.document_generated",
      resource: "articles_of_organization",
    });
    return sendPdf(reply, doc, "articles-of-organization-mi.pdf");
  });

  app.get("/llc/documents/operating-agreement.pdf", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const profile = await getProfile(userId);
    if (!profile?.entityName || !profile.organizerName) {
      return reply.code(422).send({
        error: "Set entityName and organizerName before generating the operating agreement",
      });
    }
    const doc = await operatingAgreement(toLlcData(profile) as LlcData);
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "llc.document_generated",
      resource: "operating_agreement",
    });
    return sendPdf(reply, doc, "operating-agreement.pdf");
  });

  app.get("/llc/documents/resident-agent-guide.pdf", { preHandler: requireAuth }, async (req, reply) => {
    const doc = await residentAgentGuide();
    return sendPdf(reply, doc, "resident-agent-guide.pdf");
  });

  app.get("/llc/documents/ss4-summary.pdf", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const profile = await getProfile(userId);
    if (!profile?.entityName) {
      return reply.code(422).send({ error: "Set entityName before generating the SS-4 summary" });
    }
    const doc = await ss4Summary(toLlcData(profile) as LlcData);
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "llc.document_generated",
      resource: "ss4_summary",
    });
    return sendPdf(reply, doc, "ein-ss4-prepared-answers.pdf");
  });

  // Machine-readable disclaimer + template catalog (T3.3/T3.5).
  app.get("/llc/templates", { preHandler: requireAuth }, async (_req, reply) => {
    return reply.send({
      disclaimer: LEGAL_DISCLAIMER,
      templates: [
        { id: "articles", name: "Articles of Organization (MI CSCL/CD-700)", url: "/llc/documents/articles.pdf" },
        { id: "operating-agreement", name: "Operating Agreement (member-managed)", url: "/llc/documents/operating-agreement.pdf" },
        { id: "resident-agent-guide", name: "Resident Agent Guidance", url: "/llc/documents/resident-agent-guide.pdf" },
        { id: "ss4-summary", name: "EIN / SS-4 Prepared Answers", url: "/llc/documents/ss4-summary.pdf" },
      ],
    });
  });
}

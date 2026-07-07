import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { investmentSchedules } from "../db/schema.js";
import { makeRequireAuth } from "../plugins/auth-guard.js";
import type { AppContext } from "../context.js";

/**
 * T2.3 — Investment scheduling STUBS.
 *
 * Compliance bright line: these endpoints store the user's intent only.
 * There is no integration that moves money, no balance, no custody — any
 * future execution happens at a licensed partner under their license.
 */
export const NO_CUSTODY_NOTICE =
  "SpendWHERE never holds or moves funds. Schedules are planning tools only; " +
  "no money moves until you execute them yourself at your own institution.";

const ScheduleInput = z.object({
  name: z.string().min(1).max(120),
  cadence: z.enum(["weekly", "biweekly", "monthly"]),
  amountCents: z.number().int().positive().max(100_000_000),
  target: z.enum(["emergency_fund", "index_fund", "retirement", "real_estate", "custom"]),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const ScheduleUpdate = ScheduleInput.partial().extend({
  active: z.boolean().optional(),
});

export async function investRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, db } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  app.get("/invest/schedules", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const schedules = await db.withUserDb(userId, (tx) =>
      tx.select().from(investmentSchedules).where(eq(investmentSchedules.userId, userId)),
    );
    return reply.send({ schedules, notice: NO_CUSTODY_NOTICE });
  });

  app.post("/invest/schedules", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = ScheduleInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", detail: parsed.error.flatten() });
    }
    const userId = req.auth!.sub;
    const schedule = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .insert(investmentSchedules)
        .values({ userId, ...parsed.data })
        .returning();
      return row!;
    });
    return reply.code(201).send({ schedule, notice: NO_CUSTODY_NOTICE });
  });

  app.patch("/invest/schedules/:id", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = ScheduleUpdate.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    const userId = req.auth!.sub;
    const { id } = req.params as { id: string };
    const schedule = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .update(investmentSchedules)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(investmentSchedules.id, id), eq(investmentSchedules.userId, userId)))
        .returning();
      return row ?? null;
    });
    if (!schedule) return reply.code(404).send({ error: "Schedule not found" });
    return reply.send({ schedule, notice: NO_CUSTODY_NOTICE });
  });

  app.delete("/invest/schedules/:id", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const { id } = req.params as { id: string };
    const deleted = await db.withUserDb(userId, async (tx) => {
      const rows = await tx
        .delete(investmentSchedules)
        .where(and(eq(investmentSchedules.id, id), eq(investmentSchedules.userId, userId)))
        .returning();
      return rows.length > 0;
    });
    if (!deleted) return reply.code(404).send({ error: "Schedule not found" });
    return reply.send({ ok: true });
  });
}

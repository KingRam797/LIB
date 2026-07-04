import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { complianceEvents, notifications } from "../db/schema.js";
import { makeRequireAuth } from "../plugins/auth-guard.js";
import type { AppContext } from "../context.js";

export async function calendarRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, db } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  app.get("/calendar/events", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const events = await db.withUserDb(userId, (tx) =>
      tx
        .select()
        .from(complianceEvents)
        .where(eq(complianceEvents.userId, userId))
        .orderBy(asc(complianceEvents.dueOn)),
    );
    return reply.send({ events });
  });

  app.post("/calendar/events/:id/complete", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const { id } = req.params as { id: string };
    const event = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .update(complianceEvents)
        .set({ completedAt: new Date() })
        .where(and(eq(complianceEvents.id, id), eq(complianceEvents.userId, userId)))
        .returning();
      return row ?? null;
    });
    if (!event) return reply.code(404).send({ error: "Event not found" });
    return reply.send({ event });
  });

  // T4.3 — reminders "fire" here: any open event due inside the window gets a
  // notification row (idempotent via the (user_id, event_id) unique key), and
  // the current notification list is returned.
  app.get("/calendar/reminders", { preHandler: requireAuth }, async (req, reply) => {
    const { withinDays } = req.query as { withinDays?: string };
    const days = Math.min(Math.max(Number(withinDays ?? 30) || 30, 1), 730);
    const userId = req.auth!.sub;

    const result = await db.withUserDb(userId, async (tx) => {
      const today = new Date().toISOString().slice(0, 10);
      const horizon = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const due = await tx
        .select()
        .from(complianceEvents)
        .where(
          and(
            eq(complianceEvents.userId, userId),
            isNull(complianceEvents.completedAt),
            gte(complianceEvents.dueOn, today),
            lte(complianceEvents.dueOn, horizon),
          ),
        );
      if (due.length > 0) {
        await tx
          .insert(notifications)
          .values(
            due.map((e) => ({
              userId,
              eventId: e.id,
              message: `Upcoming: ${e.title} — due ${e.dueOn}`,
            })),
          )
          .onConflictDoNothing();
      }
      const fired = await tx
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId));
      return { dueCount: due.length, notifications: fired };
    });
    return reply.send(result);
  });
}

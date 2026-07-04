import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { lessonProgress, lessons } from "../db/schema.js";
import { makeRequireAuth } from "../plugins/auth-guard.js";
import type { AppContext } from "../context.js";

export async function lessonsRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, db } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  // T2.2 — lesson list with per-user completion state.
  app.get("/lessons", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const result = await db.withUserDb(userId, async (tx) => {
      const all = await tx.select().from(lessons).orderBy(asc(lessons.sortOrder));
      const progress = await tx
        .select()
        .from(lessonProgress)
        .where(eq(lessonProgress.userId, userId));
      const done = new Set(progress.map((p) => p.lessonId));
      return all.map((l) => ({
        slug: l.slug,
        title: l.title,
        summary: l.summary,
        sortOrder: l.sortOrder,
        completed: done.has(l.id),
      }));
    });
    return reply.send({ lessons: result });
  });

  app.get("/lessons/:slug", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const { slug } = req.params as { slug: string };
    const result = await db.withUserDb(userId, async (tx) => {
      const [lesson] = await tx.select().from(lessons).where(eq(lessons.slug, slug)).limit(1);
      if (!lesson) return null;
      const [done] = await tx
        .select()
        .from(lessonProgress)
        .where(eq(lessonProgress.lessonId, lesson.id))
        .limit(1);
      return {
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        bodyMd: lesson.bodyMd,
        completed: Boolean(done),
      };
    });
    if (!result) return reply.code(404).send({ error: "Lesson not found" });
    return reply.send({ lesson: result });
  });

  app.post("/lessons/:slug/complete", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const { slug } = req.params as { slug: string };
    const ok = await db.withUserDb(userId, async (tx) => {
      const [lesson] = await tx.select().from(lessons).where(eq(lessons.slug, slug)).limit(1);
      if (!lesson) return false;
      await tx
        .insert(lessonProgress)
        .values({ userId, lessonId: lesson.id })
        .onConflictDoNothing();
      return true;
    });
    if (!ok) return reply.code(404).send({ error: "Lesson not found" });
    return reply.send({ ok: true });
  });
}

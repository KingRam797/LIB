import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { onboardingProfiles } from "../db/schema.js";
import { makeRequireAuth } from "../plugins/auth-guard.js";
import type { AppContext } from "../context.js";

const OnboardingInput = z.object({
  persona: z
    .enum(["gig_worker", "creator", "freelancer", "small_business", "investor", "other"])
    .optional(),
  incomeBand: z
    .enum(["under_30k", "30k_75k", "75k_150k", "150k_500k", "500k_1m", "1m_3m", "over_3m"])
    .optional(),
  goals: z.array(z.string().min(1).max(200)).max(20).optional(),
  homeState: z.string().length(2).toUpperCase().optional(),
  currentStep: z.number().int().min(0).max(10).optional(),
  completed: z.boolean().optional(),
});

export async function onboardingRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, db } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  // T2.1 — resumable: GET returns saved progress (or null), PUT upserts any
  // subset of fields plus the wizard step to resume from.
  app.get("/onboarding", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const profile = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .select()
        .from(onboardingProfiles)
        .where(eq(onboardingProfiles.userId, userId))
        .limit(1);
      return row ?? null;
    });
    return reply.send({ profile });
  });

  app.put("/onboarding", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = OnboardingInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", detail: parsed.error.flatten() });
    }
    const userId = req.auth!.sub;
    const { completed, ...fields } = parsed.data;

    const profile = await db.withUserDb(userId, async (tx) => {
      const set = {
        ...(fields.persona !== undefined ? { persona: fields.persona } : {}),
        ...(fields.incomeBand !== undefined ? { incomeBand: fields.incomeBand } : {}),
        ...(fields.goals !== undefined ? { goals: fields.goals } : {}),
        ...(fields.homeState !== undefined ? { homeState: fields.homeState } : {}),
        ...(fields.currentStep !== undefined ? { currentStep: fields.currentStep } : {}),
        ...(completed !== undefined ? { completedAt: completed ? new Date() : null } : {}),
        updatedAt: new Date(),
      };
      const [row] = await tx
        .insert(onboardingProfiles)
        .values({ userId, ...set })
        .onConflictDoUpdate({ target: onboardingProfiles.userId, set })
        .returning();
      return row!;
    });
    return reply.send({ profile });
  });
}

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppContext } from "./context.js";
import type { BlobStorage } from "./vault/storage.js";
import { LocalFsStorage, S3Storage } from "./vault/storage.js";
import { authRoutes } from "./routes/auth.js";
import { budgetRoutes } from "./routes/budget.js";
import { investRoutes } from "./routes/invest.js";
import { kycRoutes } from "./routes/kyc.js";
import { calendarRoutes } from "./routes/calendar.js";
import { lessonsRoutes } from "./routes/lessons.js";
import { llcRoutes } from "./routes/llc.js";
import { meRoutes } from "./routes/me.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { privacyRoutes } from "./routes/privacy.js";
import { vaultRoutes } from "./routes/vault.js";

export function createStorage(config: AppContext["config"]): BlobStorage {
  return config.vault.driver === "s3"
    ? new S3Storage(config.vault.s3!)
    : new LocalFsStorage(config.vault.localDir);
}

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const storage = ctx.storage ?? createStorage(ctx.config);
  const app = Fastify({
    logger: ctx.config.nodeEnv !== "test",
    trustProxy: true,
    bodyLimit: 16 * 1024 * 1024, // vault uploads arrive base64-encoded (~10 MB files)
  });

  // T0.5 — security headers + rate limiting at the edge of the API.
  await app.register(helmet, {
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  });
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
  });
  await app.register(cors, {
    origin: ctx.config.corsOrigin,
    credentials: true,
  });
  await app.register(cookie);

  app.get("/healthz", async () => ({ ok: true }));

  await app.register(async (scope) => authRoutes(scope, ctx));
  await app.register(async (scope) => meRoutes(scope, ctx));
  await app.register(async (scope) => kycRoutes(scope, ctx));
  await app.register(async (scope) => onboardingRoutes(scope, ctx));
  await app.register(async (scope) => lessonsRoutes(scope, ctx));
  await app.register(async (scope) => investRoutes(scope, ctx));
  await app.register(async (scope) => budgetRoutes(scope, ctx));
  await app.register(async (scope) => llcRoutes(scope, ctx));
  await app.register(async (scope) => vaultRoutes(scope, { ...ctx, storage }));
  await app.register(async (scope) => calendarRoutes(scope, ctx));
  await app.register(async (scope) => privacyRoutes(scope, { ...ctx, storage }));

  return app;
}

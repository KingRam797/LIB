/** Shared setup for integration test files. Each file gets its own database. */
import pg from "pg";
import { expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { EnvSecretsProvider, generateFieldKey } from "@spendwhere/shared";
import { buildApp } from "../app.js";
import { loadConfig, type ApiConfig } from "../config.js";
import { createDbHandle, type DbHandle } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { createKycClient } from "../kyc/persona.js";

const BASE_ADMIN_URL =
  process.env["TEST_ADMIN_DATABASE_URL"] ??
  "postgres://postgres:postgres@localhost:5432/spendwhere_test";
const APP_DB_PASSWORD = "test-app-password";

export interface TestEnv {
  app: FastifyInstance;
  config: ApiConfig;
  db: DbHandle;
  adminPool: pg.Pool;
  teardown(): Promise<void>;
}

export async function setupTestEnv(dbSuffix: string, extraEnv: Record<string, string> = {}): Promise<TestEnv> {
  const adminUrl = new URL(BASE_ADMIN_URL);
  const dbName = `${adminUrl.pathname.slice(1)}_${dbSuffix}`;
  adminUrl.pathname = `/${dbName}`;

  const bootstrapUrl = new URL(BASE_ADMIN_URL);
  bootstrapUrl.pathname = "/postgres";
  const bootstrap = new pg.Client({ connectionString: bootstrapUrl.toString() });
  await bootstrap.connect();
  await bootstrap.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await bootstrap.query(`CREATE DATABASE "${dbName}"`);
  await bootstrap.end();

  await runMigrations(adminUrl.toString(), APP_DB_PASSWORD);

  const appUrl = new URL(adminUrl.toString());
  appUrl.username = "spendwhere_app";
  appUrl.password = APP_DB_PASSWORD;

  const config = await loadConfig(
    new EnvSecretsProvider({
      DATABASE_URL: appUrl.toString(),
      JWT_SECRET: "test-jwt-secret-with-plenty-of-entropy-0123456789",
      FIELD_ENCRYPTION_KEY: generateFieldKey(),
      ...extraEnv,
    }),
    { NODE_ENV: "test", ...extraEnv },
  );
  const db = createDbHandle(config.databaseUrl);
  const adminPool = new pg.Pool({ connectionString: adminUrl.toString(), max: 3 });
  const app = await buildApp({ config, db, kyc: createKycClient(config.persona) });

  return {
    app,
    config,
    db,
    adminPool,
    async teardown() {
      await app.close();
      await db.end();
      await adminPool.end();
    },
  };
}

export interface TestSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
}

let ipCounter = 0;

export async function registerUser(app: FastifyInstance, email: string): Promise<TestSession> {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: { "x-forwarded-for": `198.51.100.${(++ipCounter % 250) + 1}` },
    payload: {
      email,
      password: "correct-horse-battery",
      displayName: email.split("@")[0],
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as TestSession;
}

export function authed(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

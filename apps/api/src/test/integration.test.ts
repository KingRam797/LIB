/**
 * End-to-end acceptance tests against a real Postgres:
 *   T0.5 — security headers + rate limiting (429 on abuse)
 *   T1.1 — register/login, token rotation, refresh-reuse revocation
 *   T1.2 — TOTP MFA + step-up on sensitive actions
 *   T1.3 — RLS: user A cannot read user B's data
 *   T1.4 — SSN/EIN/bank ciphertext at rest
 *   T1.5 — KYC stub flow: pass/fail stored, no vendor PII persisted
 *   T1.6 — append-only, tamper-evident audit log
 */
import { authenticator } from "otplib";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { EnvSecretsProvider, generateFieldKey } from "@spendwhere/shared";
import { buildApp } from "../app.js";
import { loadConfig, type ApiConfig } from "../config.js";
import { verifyAuditChain } from "../audit.js";
import { createDbHandle, type DbHandle } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { createKycClient } from "../kyc/persona.js";

const ADMIN_URL =
  process.env["TEST_ADMIN_DATABASE_URL"] ??
  "postgres://postgres:postgres@localhost:5432/spendwhere_test";
const APP_DB_PASSWORD = "test-app-password";

function appUrlFrom(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = "spendwhere_app";
  url.password = APP_DB_PASSWORD;
  return url.toString();
}

async function resetDatabase(adminUrl: string): Promise<void> {
  const url = new URL(adminUrl);
  const dbName = url.pathname.slice(1);
  url.pathname = "/postgres";
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();
}

let app: FastifyInstance;
let config: ApiConfig;
let db: DbHandle;
let adminPool: pg.Pool;

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; kycStatus: string };
}

let registerIp = 0;

async function register(email: string, password = "correct-horse-battery"): Promise<Session> {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    // Unique source IP per call so the strict credential-endpoint rate
    // limit (10/min/IP) never trips across the suite.
    headers: { "x-forwarded-for": `198.51.100.${++registerIp}` },
    payload: { email, password, displayName: email.split("@")[0] },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as Session;
}

beforeAll(async () => {
  await resetDatabase(ADMIN_URL);
  await runMigrations(ADMIN_URL, APP_DB_PASSWORD);
  config = await loadConfig(
    new EnvSecretsProvider({
      DATABASE_URL: appUrlFrom(ADMIN_URL),
      JWT_SECRET: "test-jwt-secret-with-plenty-of-entropy-0123456789",
      FIELD_ENCRYPTION_KEY: generateFieldKey(),
    }),
    { NODE_ENV: "test" },
  );
  db = createDbHandle(config.databaseUrl);
  adminPool = new pg.Pool({ connectionString: ADMIN_URL, max: 3 });
  app = await buildApp({ config, db, kyc: createKycClient(config.persona) });
});

afterAll(async () => {
  await app?.close();
  await db?.end();
  await adminPool?.end();
});

describe("T0.5 — base security", () => {
  it("sets security headers", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });

  it("returns 429 on abuse", async () => {
    // Dedicated source IP (trustProxy honors x-forwarded-for) so this
    // flood doesn't consume the shared per-IP budget of the other tests.
    let lastStatus = 200;
    for (let i = 0; i < 125; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/healthz",
        headers: { "x-forwarded-for": "203.0.113.99" },
      });
      lastStatus = res.statusCode;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});

describe("T1.1 — registration, login, token rotation", () => {
  it("registers, logs in, and rejects bad credentials", async () => {
    const session = await register("alice@example.com");
    expect(session.accessToken).toBeTruthy();
    expect(session.user.kycStatus).toBe("not_started");

    const dup = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "alice@example.com",
        password: "correct-horse-battery",
        displayName: "dupe",
      },
    });
    expect(dup.statusCode).toBe(409);

    const ok = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "alice@example.com", password: "correct-horse-battery" },
    });
    expect(ok.statusCode).toBe(200);

    const bad = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "alice@example.com", password: "wrong-password-entirely" },
    });
    expect(bad.statusCode).toBe(401);
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const session = await register("carol@example.com");

    const r1 = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: session.refreshToken },
    });
    expect(r1.statusCode).toBe(200);
    const rotated = r1.json() as { refreshToken: string; accessToken: string };
    expect(rotated.refreshToken).not.toBe(session.refreshToken);

    // Reusing the consumed token = theft signal -> whole family dies.
    const reuse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: session.refreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    const afterReuse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: rotated.refreshToken },
    });
    expect(afterReuse.statusCode).toBe(401);
  });

  it("access token works against /me", async () => {
    const session = await register("dave@example.com");
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { user: { email: string } }).user.email).toBe("dave@example.com");
  });
});

describe("T1.2 — MFA (TOTP) with step-up on sensitive actions", () => {
  let session: Session;
  let mfaSession: { accessToken: string };
  let secret: string;

  it("enrolls and enables TOTP", async () => {
    session = await register("mallory@example.com");
    const enroll = await app.inject({
      method: "POST",
      url: "/auth/mfa/enroll",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(enroll.statusCode).toBe(200);
    const uri = (enroll.json() as { otpauthUri: string }).otpauthUri;
    secret = new URL(uri).searchParams.get("secret")!;
    expect(secret).toBeTruthy();

    const verify = await app.inject({
      method: "POST",
      url: "/auth/mfa/verify",
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { code: authenticator.generate(secret) },
    });
    expect(verify.statusCode).toBe(200);
    mfaSession = verify.json() as { accessToken: string };
  });

  it("requires TOTP at login once enabled", async () => {
    const withoutCode = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "mallory@example.com", password: "correct-horse-battery" },
    });
    expect(withoutCode.statusCode).toBe(401);
    expect((withoutCode.json() as { mfaRequired?: boolean }).mfaRequired).toBe(true);

    const withCode = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "mallory@example.com",
        password: "correct-horse-battery",
        totpCode: authenticator.generate(secret),
      },
    });
    expect(withCode.statusCode).toBe(200);
  });

  it("blocks sensitive actions for non-MFA sessions when MFA is enabled", async () => {
    // Original pre-MFA token: rejected.
    const blocked = await app.inject({
      method: "PUT",
      url: "/me/sensitive",
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { ssn: "123-45-6789" },
    });
    expect(blocked.statusCode).toBe(403);

    // MFA-verified token: allowed.
    const allowed = await app.inject({
      method: "PUT",
      url: "/me/sensitive",
      headers: { authorization: `Bearer ${mfaSession.accessToken}` },
      payload: { ssn: "123-45-6789" },
    });
    expect(allowed.statusCode).toBe(200);
  });
});

describe("T1.4 — field-level encryption at rest", () => {
  let session: Session;

  it("stores only ciphertext in the database", async () => {
    session = await register("peggy@example.com");
    const put = await app.inject({
      method: "PUT",
      url: "/me/sensitive",
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { ssn: "987-65-4321", ein: "12-3456789", bankRouting: "021000021" },
    });
    expect(put.statusCode).toBe(200);

    const { rows } = await adminPool.query(
      "SELECT ssn_enc, ein_enc, bank_routing_enc FROM sensitive_profiles WHERE user_id = $1",
      [session.user.id],
    );
    expect(rows).toHaveLength(1);
    for (const [column, plaintext] of [
      ["ssn_enc", "987654321"],
      ["ein_enc", "123456789"],
      ["bank_routing_enc", "021000021"],
    ] as const) {
      const stored: string = rows[0][column];
      expect(stored.startsWith("v1:")).toBe(true);
      expect(stored).not.toContain(plaintext);
      expect(stored).not.toContain(plaintext.slice(0, 5));
    }
  });

  it("decrypts only in the app and returns masked values", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/me/sensitive",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const profile = (res.json() as { profile: { ssn: string } }).profile;
    expect(profile.ssn.endsWith("4321")).toBe(true);
    expect(profile.ssn).not.toContain("98765");
  });
});

describe("T1.3 — RLS isolation between users", () => {
  it("user A cannot read or write user B's rows", async () => {
    const a = await register("rls-a@example.com");
    const b = await register("rls-b@example.com");
    await app.inject({
      method: "PUT",
      url: "/me/sensitive",
      headers: { authorization: `Bearer ${b.accessToken}` },
      payload: { ssn: "111-22-3333" },
    });

    await db.withUserDb(a.user.id, async (tx) => {
      const others = await tx.execute(
        `SELECT * FROM sensitive_profiles WHERE user_id = '${b.user.id}'`,
      );
      expect(others.rows).toHaveLength(0);

      const visibleUsers = await tx.execute("SELECT id FROM users");
      expect(visibleUsers.rows).toHaveLength(1);
      expect(visibleUsers.rows[0]!["id"]).toBe(a.user.id);

      const stolen = await tx.execute(
        `UPDATE users SET display_name = 'pwned' WHERE id = '${b.user.id}' RETURNING id`,
      );
      expect(stolen.rows).toHaveLength(0);
    });
  });

  it("returns no rows when no user context is set", async () => {
    const bare = await db.pool.query("SELECT * FROM users");
    expect(bare.rows).toHaveLength(0);
  });
});

describe("T1.5 — KYC gate (stub vendor mode)", () => {
  it("runs the full inquiry lifecycle storing only status + inquiry id", async () => {
    const session = await register("kyc-user@example.com");
    const start = await app.inject({
      method: "POST",
      url: "/kyc/start",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(start.statusCode).toBe(201);
    const { inquiryId, stub } = start.json() as { inquiryId: string; stub: boolean };
    expect(stub).toBe(true);

    const pending = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect((pending.json() as { user: { kycStatus: string } }).user.kycStatus).toBe("pending");

    const complete = await app.inject({
      method: "POST",
      url: "/kyc/dev/complete",
      payload: { inquiryId, outcome: "passed" },
    });
    expect(complete.statusCode).toBe(200);

    const passed = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect((passed.json() as { user: { kycStatus: string } }).user.kycStatus).toBe("passed");

    // Only the vendor reference + status live in the DB — no KYC PII columns exist.
    const { rows } = await adminPool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'kyc_inquiries'",
    );
    const columns = rows.map((r) => r.column_name as string);
    expect(columns.sort()).toEqual(
      ["created_at", "id", "inquiry_id", "status", "updated_at", "user_id", "vendor"].sort(),
    );
  });

  it("rejects unsigned webhooks when a webhook secret is configured", async () => {
    const kyc = createKycClient({ webhookSecret: "whsec_test", environment: "sandbox" });
    expect(kyc.verifyWebhookSignature('{"a":1}', undefined)).toBe(false);
    expect(kyc.verifyWebhookSignature('{"a":1}', "t=123,v1=deadbeef")).toBe(false);
  });
});

describe("T1.6 — immutable, tamper-evident audit log", () => {
  it("recorded auth + PII events and the chain verifies", async () => {
    const { rows } = await adminPool.query(
      "SELECT DISTINCT action FROM audit_log ORDER BY action",
    );
    const actions = rows.map((r) => r.action as string);
    expect(actions).toContain("auth.register");
    expect(actions).toContain("auth.login");
    expect(actions).toContain("auth.login.failed");
    expect(actions).toContain("auth.mfa.enabled");
    expect(actions).toContain("pii.read");
    expect(actions).toContain("pii.write");
    expect(actions).toContain("kyc.started");
    expect(actions).toContain("kyc.passed");

    const verification = await verifyAuditChain(adminPool);
    expect(verification.entries).toBeGreaterThan(10);
    expect(verification.valid).toBe(true);
  });

  it("rejects UPDATE/DELETE even for the admin role", async () => {
    await expect(adminPool.query("UPDATE audit_log SET action = 'forged' WHERE id = 1")).rejects
      .toThrow(/append-only/);
    await expect(adminPool.query("DELETE FROM audit_log WHERE id = 1")).rejects.toThrow(
      /append-only/,
    );
    await expect(db.pool.query("UPDATE audit_log SET action = 'forged' WHERE id = 1")).rejects
      .toThrow();
  });

  it("detects tampering if protections are forcibly bypassed", async () => {
    // Simulate a hostile DBA: disable the trigger, rewrite history, re-enable.
    const client = await adminPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update");
      await client.query("UPDATE audit_log SET detail = '{\"forged\":true}'::jsonb WHERE id = 2");
      await client.query("ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update");
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const verification = await verifyAuditChain(adminPool);
    expect(verification.valid).toBe(false);
    expect(verification.brokenAtId).toBe(2);
  });
});

/**
 * Phase 4 acceptance tests:
 *   T4.1 — vault upload/download, ciphertext at rest, per-user isolation
 *   T4.2 — classification + search
 *   T4.3 — calendar auto-populates from LLC data; reminders fire
 *   T4.4 — export + delete (CCPA-ready)
 */
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { planLlcEvents } from "../calendar/events.js";
import { authed, registerUser, setupTestEnv, type TestEnv, type TestSession } from "./helpers.js";

let env: TestEnv;
let session: TestSession;
let vaultDir: string;

const FILE_CONTENT = "EIN Confirmation CP575 — Golden Basket Media LLC — 88-1234567";

beforeAll(async () => {
  vaultDir = mkdtempSync(join(tmpdir(), "spendwhere-vault-"));
  env = await setupTestEnv("phase4", { VAULT_STORAGE_DIR: vaultDir });
  session = await registerUser(env.app, "phase4@example.com");
});

afterAll(async () => {
  await env.teardown();
});

describe("T4.1 — encrypted document vault", () => {
  let docId: string;

  it("uploads and downloads a document byte-for-byte", async () => {
    const up = await env.app.inject({
      method: "POST",
      url: "/vault/documents",
      headers: authed(session.accessToken),
      payload: {
        filename: "ein-letter.txt",
        contentType: "text/plain",
        category: "ein_letter",
        tags: ["irs", "ein"],
        dataBase64: Buffer.from(FILE_CONTENT).toString("base64"),
      },
    });
    expect(up.statusCode).toBe(201);
    docId = (up.json() as { document: { id: string } }).document.id;

    const down = await env.app.inject({
      method: "GET",
      url: `/vault/documents/${docId}/download`,
      headers: authed(session.accessToken),
    });
    expect(down.statusCode).toBe(200);
    expect(down.rawPayload.toString()).toBe(FILE_CONTENT);
    expect(down.headers["content-type"]).toBe("text/plain");
  });

  it("stores only ciphertext at rest", async () => {
    const userDirs = readdirSync(vaultDir);
    expect(userDirs.length).toBeGreaterThan(0);
    const files = readdirSync(join(vaultDir, userDirs[0]!));
    const blob = readFileSync(join(vaultDir, userDirs[0]!, files[0]!));
    expect(blob.toString()).not.toContain("CP575");
    expect(blob.toString()).not.toContain("88-1234567");
    // GCM layout: 12-byte IV + ciphertext + 16-byte tag => larger than plaintext.
    expect(blob.length).toBe(Buffer.byteLength(FILE_CONTENT) + 28);
  });

  it("is isolated per user — another user cannot see or fetch the document", async () => {
    const other = await registerUser(env.app, "phase4-other@example.com");
    const list = await env.app.inject({
      method: "GET",
      url: "/vault/documents",
      headers: authed(other.accessToken),
    });
    expect((list.json() as { documents: unknown[] }).documents).toHaveLength(0);

    const steal = await env.app.inject({
      method: "GET",
      url: `/vault/documents/${docId}/download`,
      headers: authed(other.accessToken),
    });
    expect(steal.statusCode).toBe(404);
  });

  it("delete removes both the row and the blob", async () => {
    const up = await env.app.inject({
      method: "POST",
      url: "/vault/documents",
      headers: authed(session.accessToken),
      payload: {
        filename: "scratch.txt",
        contentType: "text/plain",
        dataBase64: Buffer.from("temp").toString("base64"),
      },
    });
    const id = (up.json() as { document: { id: string } }).document.id;
    const before = readdirSync(join(vaultDir, session.user.id)).length;

    const del = await env.app.inject({
      method: "DELETE",
      url: `/vault/documents/${id}`,
      headers: authed(session.accessToken),
    });
    expect(del.statusCode).toBe(200);
    expect(readdirSync(join(vaultDir, session.user.id)).length).toBe(before - 1);
  });
});

describe("T4.2 — classification, tagging, search", () => {
  it("filters by category, tag, and filename", async () => {
    await env.app.inject({
      method: "POST",
      url: "/vault/documents",
      headers: authed(session.accessToken),
      payload: {
        filename: "operating-agreement-signed.pdf",
        contentType: "application/pdf",
        category: "operating_agreement",
        tags: ["signed", "2026"],
        dataBase64: Buffer.from("%PDF-fake").toString("base64"),
      },
    });

    const byCategory = await env.app.inject({
      method: "GET",
      url: "/vault/documents?category=ein_letter",
      headers: authed(session.accessToken),
    });
    const cats = (byCategory.json() as { documents: { category: string }[] }).documents;
    expect(cats.length).toBe(1);
    expect(cats[0]!.category).toBe("ein_letter");

    const byTag = await env.app.inject({
      method: "GET",
      url: "/vault/documents?tag=signed",
      headers: authed(session.accessToken),
    });
    expect((byTag.json() as { documents: unknown[] }).documents).toHaveLength(1);

    const byQuery = await env.app.inject({
      method: "GET",
      url: "/vault/documents?q=operating",
      headers: authed(session.accessToken),
    });
    const found = (byQuery.json() as { documents: { filename: string }[] }).documents;
    expect(found).toHaveLength(1);
    expect(found[0]!.filename).toContain("operating-agreement");
  });

  it("re-categorizes via PATCH", async () => {
    const list = await env.app.inject({
      method: "GET",
      url: "/vault/documents?q=operating",
      headers: authed(session.accessToken),
    });
    const id = (list.json() as { documents: { id: string }[] }).documents[0]!.id;
    const patch = await env.app.inject({
      method: "PATCH",
      url: `/vault/documents/${id}`,
      headers: authed(session.accessToken),
      payload: { category: "tax", tags: ["archived"] },
    });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { document: { category: string } }).document.category).toBe("tax");
  });
});

describe("T4.3 — compliance calendar", () => {
  it("plans MI annual statements + quarterly taxes from the formation date", () => {
    const events = planLlcEvents("2026-05-01");
    const statements = events.filter((e) => e.kind === "mi_annual_statement");
    expect(statements[0]!.dueOn).toBe("2027-02-15");

    const taxes = events.filter((e) => e.kind === "estimated_tax").map((e) => e.dueOn);
    expect(taxes).toEqual(["2026-06-15", "2026-09-15", "2027-01-15", "2027-04-15"]);
  });

  it("skips the first February for LLCs formed after Sept 30 (spec rule)", () => {
    const events = planLlcEvents("2026-10-15");
    const statements = events.filter((e) => e.kind === "mi_annual_statement");
    expect(statements[0]!.dueOn).toBe("2028-02-15");
  });

  it("auto-populates events when the LLC filing date is recorded", async () => {
    const put = await env.app.inject({
      method: "PUT",
      url: "/llc/profile",
      headers: authed(session.accessToken),
      payload: { entityName: "Golden Basket Media LLC", formedOn: "2026-05-01" },
    });
    expect(put.statusCode).toBe(200);

    const res = await env.app.inject({
      method: "GET",
      url: "/calendar/events",
      headers: authed(session.accessToken),
    });
    const events = (res.json() as { events: { kind: string; dueOn: string }[] }).events;
    expect(events.some((e) => e.kind === "mi_annual_statement" && e.dueOn === "2027-02-15")).toBe(true);
    expect(events.filter((e) => e.kind === "estimated_tax")).toHaveLength(4);

    // Idempotent: saving again doesn't duplicate.
    await env.app.inject({
      method: "PUT",
      url: "/llc/profile",
      headers: authed(session.accessToken),
      payload: { formedOn: "2026-05-01" },
    });
    const again = await env.app.inject({
      method: "GET",
      url: "/calendar/events",
      headers: authed(session.accessToken),
    });
    expect((again.json() as { events: unknown[] }).events).toHaveLength(events.length);
  });

  it("fires reminders for events inside the window (notifications persist)", async () => {
    const res = await env.app.inject({
      method: "GET",
      url: "/calendar/reminders?withinDays=400",
      headers: authed(session.accessToken),
    });
    const body = res.json() as { dueCount: number; notifications: { message: string }[] };
    expect(body.dueCount).toBeGreaterThan(0);
    expect(body.notifications.length).toBeGreaterThan(0);
    expect(body.notifications[0]!.message).toContain("due");

    // Firing twice doesn't duplicate notifications.
    const again = await env.app.inject({
      method: "GET",
      url: "/calendar/reminders?withinDays=400",
      headers: authed(session.accessToken),
    });
    expect((again.json() as { notifications: unknown[] }).notifications).toHaveLength(
      body.notifications.length,
    );
  });

  it("marks events complete", async () => {
    const events = await env.app.inject({
      method: "GET",
      url: "/calendar/events",
      headers: authed(session.accessToken),
    });
    const first = (events.json() as { events: { id: string }[] }).events[0]!;
    const done = await env.app.inject({
      method: "POST",
      url: `/calendar/events/${first.id}/complete`,
      headers: authed(session.accessToken),
    });
    expect(done.statusCode).toBe(200);
    expect((done.json() as { event: { completedAt: string } }).event.completedAt).toBeTruthy();
  });
});

describe("T4.4 — export + delete (CCPA-ready)", () => {
  it("exports all user data sections", async () => {
    const res = await env.app.inject({
      method: "GET",
      url: "/me/export",
      headers: authed(session.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    for (const key of [
      "user",
      "onboarding",
      "lessonProgress",
      "investmentSchedules",
      "budgetTransactions",
      "llcProfile",
      "kycInquiries",
      "documents",
      "complianceEvents",
      "notifications",
      "auditTrail",
    ]) {
      expect(body).toHaveProperty(key);
    }
    expect((body["documents"] as unknown[]).length).toBeGreaterThan(0);
    expect((body["auditTrail"] as unknown[]).length).toBeGreaterThan(0);
  });

  it("deletes the account, its rows, and its vault blobs", async () => {
    const victim = await registerUser(env.app, "phase4-delete-me@example.com");
    await env.app.inject({
      method: "POST",
      url: "/vault/documents",
      headers: authed(victim.accessToken),
      payload: {
        filename: "doomed.txt",
        contentType: "text/plain",
        dataBase64: Buffer.from("delete me").toString("base64"),
      },
    });
    expect(readdirSync(join(vaultDir, victim.user.id))).toHaveLength(1);

    const wrongPw = await env.app.inject({
      method: "POST",
      url: "/me/delete",
      headers: authed(victim.accessToken),
      payload: { password: "not-the-password" },
    });
    expect(wrongPw.statusCode).toBe(401);

    const del = await env.app.inject({
      method: "POST",
      url: "/me/delete",
      headers: authed(victim.accessToken),
      payload: { password: "correct-horse-battery" },
    });
    expect(del.statusCode).toBe(200);

    // Blobs gone, DB rows gone, login impossible.
    expect(readdirSync(join(vaultDir, victim.user.id))).toHaveLength(0);
    const { rows } = await env.adminPool.query("SELECT 1 FROM users WHERE id = $1", [
      victim.user.id,
    ]);
    expect(rows).toHaveLength(0);
    const login = await env.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "phase4-delete-me@example.com", password: "correct-horse-battery" },
    });
    expect(login.statusCode).toBe(401);

    // The deletion itself is on the retained audit record.
    const audit = await env.adminPool.query(
      "SELECT 1 FROM audit_log WHERE action = 'privacy.account_deleted' AND actor_user_id = $1",
      [victim.user.id],
    );
    expect(audit.rows).toHaveLength(1);
  });
});

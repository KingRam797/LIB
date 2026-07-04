/**
 * Phase 2 acceptance tests:
 *   T2.1 — onboarding profile saved + resumable
 *   T2.2 — lessons render, completion tracked
 *   T2.3 — schedules definable, no money movement anywhere
 *   T2.4 — dashboard categorizes spend, read-only tax math
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authed, registerUser, setupTestEnv, type TestEnv, type TestSession } from "./helpers.js";

let env: TestEnv;
let session: TestSession;

beforeAll(async () => {
  env = await setupTestEnv("phase2");
  session = await registerUser(env.app, "phase2@example.com");
});

afterAll(async () => {
  await env.teardown();
});

describe("T2.1 — onboarding wizard (resumable)", () => {
  it("saves partial progress and resumes at the stored step", async () => {
    const step1 = await env.app.inject({
      method: "PUT",
      url: "/onboarding",
      headers: authed(session.accessToken),
      payload: { persona: "creator", currentStep: 1 },
    });
    expect(step1.statusCode).toBe(200);

    // Simulate returning later: GET restores exactly what was saved.
    const resume = await env.app.inject({
      method: "GET",
      url: "/onboarding",
      headers: authed(session.accessToken),
    });
    const profile = (resume.json() as { profile: Record<string, unknown> }).profile;
    expect(profile["persona"]).toBe("creator");
    expect(profile["currentStep"]).toBe(1);
    expect(profile["completedAt"]).toBeNull();

    const finish = await env.app.inject({
      method: "PUT",
      url: "/onboarding",
      headers: authed(session.accessToken),
      payload: {
        incomeBand: "75k_150k",
        homeState: "mi",
        goals: ["form an LLC", "build 6-month runway"],
        currentStep: 3,
        completed: true,
      },
    });
    expect(finish.statusCode).toBe(200);
    const done = (finish.json() as { profile: Record<string, unknown> }).profile;
    expect(done["persona"]).toBe("creator"); // earlier answers survive
    expect(done["homeState"]).toBe("MI");
    expect(done["completedAt"]).not.toBeNull();
  });

  it("rejects invalid enum values", async () => {
    const res = await env.app.inject({
      method: "PUT",
      url: "/onboarding",
      headers: authed(session.accessToken),
      payload: { persona: "astronaut" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("T2.2 — financial literacy framework", () => {
  it("renders seeded lessons and tracks completion", async () => {
    const list = await env.app.inject({
      method: "GET",
      url: "/lessons",
      headers: authed(session.accessToken),
    });
    expect(list.statusCode).toBe(200);
    const lessons = (list.json() as { lessons: { slug: string; completed: boolean }[] }).lessons;
    expect(lessons.length).toBeGreaterThanOrEqual(5);
    expect(lessons.every((l) => !l.completed)).toBe(true);

    const slug = lessons[0]!.slug;
    const detail = await env.app.inject({
      method: "GET",
      url: `/lessons/${slug}`,
      headers: authed(session.accessToken),
    });
    expect(detail.statusCode).toBe(200);
    expect((detail.json() as { lesson: { bodyMd: string } }).lesson.bodyMd).toContain("#");

    const complete = await env.app.inject({
      method: "POST",
      url: `/lessons/${slug}/complete`,
      headers: authed(session.accessToken),
    });
    expect(complete.statusCode).toBe(200);

    const after = await env.app.inject({
      method: "GET",
      url: "/lessons",
      headers: authed(session.accessToken),
    });
    const updated = (after.json() as { lessons: { slug: string; completed: boolean }[] }).lessons;
    expect(updated.find((l) => l.slug === slug)!.completed).toBe(true);
  });

  it("completion is per-user", async () => {
    const other = await registerUser(env.app, "phase2-other@example.com");
    const list = await env.app.inject({
      method: "GET",
      url: "/lessons",
      headers: authed(other.accessToken),
    });
    const lessons = (list.json() as { lessons: { completed: boolean }[] }).lessons;
    expect(lessons.every((l) => !l.completed)).toBe(true);
  });
});

describe("T2.3 — investment scheduling stubs (no fund movement)", () => {
  it("creates, updates, and deletes a schedule — with the no-custody notice", async () => {
    const create = await env.app.inject({
      method: "POST",
      url: "/invest/schedules",
      headers: authed(session.accessToken),
      payload: {
        name: "Weekly index fund",
        cadence: "weekly",
        amountCents: 5000,
        target: "index_fund",
        startsOn: "2026-08-01",
      },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json() as { schedule: { id: string }; notice: string };
    expect(created.notice).toContain("never holds or moves funds");

    const pause = await env.app.inject({
      method: "PATCH",
      url: `/invest/schedules/${created.schedule.id}`,
      headers: authed(session.accessToken),
      payload: { active: false },
    });
    expect(pause.statusCode).toBe(200);
    expect((pause.json() as { schedule: { active: boolean } }).schedule.active).toBe(false);

    const del = await env.app.inject({
      method: "DELETE",
      url: `/invest/schedules/${created.schedule.id}`,
      headers: authed(session.accessToken),
    });
    expect(del.statusCode).toBe(200);
  });

  it("has no payment/transfer columns — the data model cannot move money", async () => {
    const { rows } = await env.adminPool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'investment_schedules'",
    );
    const columns = rows.map((r) => r.column_name as string);
    for (const forbidden of ["account", "iban", "routing", "wallet", "tx", "executed"]) {
      expect(columns.some((c) => c.includes(forbidden))).toBe(false);
    }
  });
});

describe("T2.4 — budgeting/tax dashboard (read-only)", () => {
  it("imports transactions and categorizes spend with tax set-aside math", async () => {
    const post = await env.app.inject({
      method: "POST",
      url: "/budget/transactions",
      headers: authed(session.accessToken),
      payload: {
        transactions: [
          { occurredOn: "2026-06-03", description: "Client invoice", amountCents: 400000, category: "income", source: "import" },
          { occurredOn: "2026-06-05", description: "Rent", amountCents: -120000, category: "housing" },
          { occurredOn: "2026-06-10", description: "Groceries", amountCents: -25000, category: "food" },
          { occurredOn: "2026-06-12", description: "Software subs", amountCents: -8000, category: "business" },
          { occurredOn: "2026-06-15", description: "Estimated tax payment", amountCents: -60000, category: "taxes" },
        ],
      },
    });
    expect(post.statusCode).toBe(201);
    expect((post.json() as { inserted: number }).inserted).toBe(5);

    const summary = await env.app.inject({
      method: "GET",
      url: "/budget/summary?month=2026-06",
      headers: authed(session.accessToken),
    });
    expect(summary.statusCode).toBe(200);
    const s = summary.json() as {
      incomeCents: number;
      spendCents: number;
      netCents: number;
      spendByCategory: Record<string, number>;
      tax: { suggestedSetAsideCents: number; setAsideSoFarCents: number; gapCents: number };
    };
    expect(s.incomeCents).toBe(400000);
    expect(s.spendCents).toBe(213000);
    expect(s.netCents).toBe(187000);
    expect(s.spendByCategory["housing"]).toBe(120000);
    expect(s.spendByCategory["business"]).toBe(8000);
    expect(s.tax.suggestedSetAsideCents).toBe(112000); // 28% of 4000.00
    expect(s.tax.setAsideSoFarCents).toBe(60000);
    expect(s.tax.gapCents).toBe(52000);
  });

  it("only returns the requested month", async () => {
    const other = await env.app.inject({
      method: "GET",
      url: "/budget/transactions?month=2026-05",
      headers: authed(session.accessToken),
    });
    expect((other.json() as { transactions: unknown[] }).transactions).toHaveLength(0);
  });

  it("transactions are isolated between users (RLS)", async () => {
    const other = await registerUser(env.app, "phase2-rls@example.com");
    const res = await env.app.inject({
      method: "GET",
      url: "/budget/transactions?month=2026-06",
      headers: authed(other.accessToken),
    });
    expect((res.json() as { transactions: unknown[] }).transactions).toHaveLength(0);
  });
});

import { and, eq, gte, lte } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { budgetTransactions } from "../db/schema.js";
import { makeRequireAuth } from "../plugins/auth-guard.js";
import type { AppContext } from "../context.js";

/**
 * T2.4 — Budgeting/tax dashboard v1. Manual or imported rows; all math is
 * read-only reporting. No accounts are linked, no funds are touched.
 */

const TransactionInput = z.object({
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(300),
  amountCents: z
    .number()
    .int()
    .refine((n) => n !== 0, "amountCents must be non-zero"),
  category: z.enum([
    "income",
    "housing",
    "food",
    "transportation",
    "business",
    "healthcare",
    "taxes",
    "savings",
    "entertainment",
    "other",
  ]),
  source: z.enum(["manual", "import"]).default("manual"),
});

const BulkInput = z.object({
  transactions: z.array(TransactionInput).min(1).max(1000),
});

/** Default set-aside guidance for self-employment income (educational). */
export const DEFAULT_TAX_SET_ASIDE_RATE = 0.28;

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export async function budgetRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, db } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  app.post("/budget/transactions", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = BulkInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", detail: parsed.error.flatten() });
    }
    const userId = req.auth!.sub;
    const inserted = await db.withUserDb(userId, async (tx) => {
      const rows = await tx
        .insert(budgetTransactions)
        .values(parsed.data.transactions.map((t) => ({ userId, ...t })))
        .returning();
      return rows.length;
    });
    return reply.code(201).send({ inserted });
  });

  app.get("/budget/transactions", { preHandler: requireAuth }, async (req, reply) => {
    const { month } = req.query as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return reply.code(400).send({ error: "month=YYYY-MM required" });
    }
    const userId = req.auth!.sub;
    const { from, to } = monthRange(month);
    const transactions = await db.withUserDb(userId, (tx) =>
      tx
        .select()
        .from(budgetTransactions)
        .where(
          and(
            eq(budgetTransactions.userId, userId),
            gte(budgetTransactions.occurredOn, from),
            lte(budgetTransactions.occurredOn, to),
          ),
        ),
    );
    return reply.send({ transactions });
  });

  app.delete("/budget/transactions/:id", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const { id } = req.params as { id: string };
    const deleted = await db.withUserDb(userId, async (tx) => {
      const rows = await tx
        .delete(budgetTransactions)
        .where(and(eq(budgetTransactions.id, id), eq(budgetTransactions.userId, userId)))
        .returning();
      return rows.length > 0;
    });
    if (!deleted) return reply.code(404).send({ error: "Transaction not found" });
    return reply.send({ ok: true });
  });

  // Read-only monthly rollup: income, spend by category, net, and an
  // educational tax set-aside estimate on income.
  app.get("/budget/summary", { preHandler: requireAuth }, async (req, reply) => {
    const { month } = req.query as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return reply.code(400).send({ error: "month=YYYY-MM required" });
    }
    const userId = req.auth!.sub;
    const { from, to } = monthRange(month);
    const rows = await db.withUserDb(userId, (tx) =>
      tx
        .select()
        .from(budgetTransactions)
        .where(
          and(
            eq(budgetTransactions.userId, userId),
            gte(budgetTransactions.occurredOn, from),
            lte(budgetTransactions.occurredOn, to),
          ),
        ),
    );

    let incomeCents = 0;
    let spendCents = 0;
    const spendByCategory: Record<string, number> = {};
    let taxesPaidCents = 0;
    for (const row of rows) {
      if (row.amountCents > 0) {
        incomeCents += row.amountCents;
      } else {
        const spent = -row.amountCents;
        spendCents += spent;
        spendByCategory[row.category] = (spendByCategory[row.category] ?? 0) + spent;
        if (row.category === "taxes") taxesPaidCents += spent;
      }
    }
    const suggestedSetAsideCents = Math.round(incomeCents * DEFAULT_TAX_SET_ASIDE_RATE);
    return reply.send({
      month,
      incomeCents,
      spendCents,
      netCents: incomeCents - spendCents,
      spendByCategory,
      tax: {
        rate: DEFAULT_TAX_SET_ASIDE_RATE,
        suggestedSetAsideCents,
        setAsideSoFarCents: taxesPaidCents,
        gapCents: Math.max(0, suggestedSetAsideCents - taxesPaidCents),
        note:
          "Educational estimate only, not tax advice. Your actual rate depends on " +
          "bracket, state, and deductions — confirm with a tax professional.",
      },
    });
  });
}

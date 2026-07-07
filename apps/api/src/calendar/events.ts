/**
 * T4.3 — compliance event generation.
 *
 * Michigan rules implemented (from the spec):
 * - Annual Statement due Feb 15 each year, $25 (MCL 450.4207a). LLCs formed
 *   after Sept 30 skip the first February.
 * - Federal quarterly estimated taxes (Form 1040-ES): Apr 15, Jun 15,
 *   Sep 15, and Jan 15 of the following year.
 */
import type { Db } from "../db/client.js";
import { complianceEvents } from "../db/schema.js";

export interface PlannedEvent {
  kind: string;
  title: string;
  description: string;
  dueOn: string; // YYYY-MM-DD
  source: "llc" | "system";
}

export function planLlcEvents(formedOn: string, yearsAhead = 3): PlannedEvent[] {
  const formed = new Date(`${formedOn}T00:00:00Z`);
  const formedYear = formed.getUTCFullYear();
  const formedAfterSept30 = formed.getTime() > Date.UTC(formedYear, 8, 30); // Sept 30

  const events: PlannedEvent[] = [];

  // MI Annual Statement: first due the Feb 15 after formation — unless formed
  // after Sept 30, in which case the first February is skipped.
  const firstStatementYear = formedYear + (formedAfterSept30 ? 2 : 1);
  for (let i = 0; i < yearsAhead; i++) {
    const year = firstStatementYear + i;
    events.push({
      kind: "mi_annual_statement",
      title: `Michigan Annual Statement due ($25)`,
      description:
        "File the LLC Annual Statement with LARA by February 15. LARA mails a " +
        "pre-filled form to your resident agent about 90 days before the deadline.",
      dueOn: `${year}-02-15`,
      source: "llc",
    });
  }

  // Next 4 federal estimated-tax dates strictly after formation.
  const quarterlies: Array<[month: number, day: number]> = [
    [3, 15], // Apr 15
    [5, 15], // Jun 15
    [8, 15], // Sep 15
  ];
  const candidates: Date[] = [];
  for (let year = formedYear; year <= formedYear + 2; year++) {
    for (const [month, day] of quarterlies) {
      candidates.push(new Date(Date.UTC(year, month, day)));
    }
    candidates.push(new Date(Date.UTC(year + 1, 0, 15))); // Jan 15 of following year
  }
  const upcoming = candidates
    .filter((d) => d.getTime() > formed.getTime())
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, 4);
  for (const due of upcoming) {
    events.push({
      kind: "estimated_tax",
      title: "Federal quarterly estimated tax payment (Form 1040-ES)",
      description:
        "Pay federal estimated tax on self-employment income to avoid underpayment " +
        "penalties. Educational reminder, not tax advice.",
      dueOn: due.toISOString().slice(0, 10),
      source: "system",
    });
  }

  return events;
}

/** Idempotent insert — (user_id, kind, due_on) is unique. */
export async function ensureLlcEvents(db: Db, userId: string, formedOn: string): Promise<void> {
  const planned = planLlcEvents(formedOn);
  if (planned.length === 0) return;
  await db
    .insert(complianceEvents)
    .values(planned.map((e) => ({ userId, ...e })))
    .onConflictDoNothing();
}

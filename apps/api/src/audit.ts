/**
 * T1.6 — Immutable audit logging.
 *
 * Every entry is chained to the previous one via SHA-256
 * (entry_hash = sha256(prev_hash + canonical entry)), so any retroactive
 * edit breaks the chain and is detectable with verifyAuditChain(). The
 * table itself rejects UPDATE/DELETE/TRUNCATE via trigger, and the runtime
 * role only holds INSERT+SELECT.
 *
 * Appends serialize on a Postgres advisory lock so the chain never forks
 * under concurrency.
 */
import { createHash } from "node:crypto";
import type pg from "pg";

const AUDIT_LOCK_KEY = 815_001;

export interface AuditEvent {
  actorUserId?: string | null;
  action: string;
  resource: string;
  detail?: Record<string, unknown>;
}

/**
 * Deterministic JSON with recursively sorted object keys — Postgres jsonb
 * does not preserve key order, so hashing must not depend on it.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonical(event: AuditEvent, occurredAt: string): string {
  return stableStringify({
    occurredAt,
    actorUserId: event.actorUserId ?? null,
    action: event.action,
    resource: event.resource,
    detail: event.detail ?? {},
  });
}

export async function appendAudit(pool: pg.Pool, event: AuditEvent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [AUDIT_LOCK_KEY]);
    const prev = await client.query(
      "SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1",
    );
    const prevHash: string = prev.rows[0]?.entry_hash ?? "genesis";
    const occurredAt = new Date().toISOString();
    const entryHash = createHash("sha256")
      .update(prevHash)
      .update(canonical(event, occurredAt))
      .digest("hex");
    await client.query(
      `INSERT INTO audit_log (occurred_at, actor_user_id, action, resource, detail, prev_hash, entry_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        occurredAt,
        event.actorUserId ?? null,
        event.action,
        event.resource,
        JSON.stringify(event.detail ?? {}),
        prevHash,
        entryHash,
      ],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export interface ChainVerification {
  valid: boolean;
  entries: number;
  brokenAtId?: number;
}

export async function verifyAuditChain(pool: pg.Pool): Promise<ChainVerification> {
  const { rows } = await pool.query(
    `SELECT id, occurred_at, actor_user_id, action, resource, detail, prev_hash, entry_hash
     FROM audit_log ORDER BY id ASC`,
  );
  let prevHash = "genesis";
  for (const row of rows) {
    const expected = createHash("sha256")
      .update(prevHash)
      .update(
        canonical(
          {
            actorUserId: row.actor_user_id,
            action: row.action,
            resource: row.resource,
            detail: row.detail,
          },
          new Date(row.occurred_at).toISOString(),
        ),
      )
      .digest("hex");
    if (row.prev_hash !== prevHash || row.entry_hash !== expected) {
      return { valid: false, entries: rows.length, brokenAtId: Number(row.id) };
    }
    prevHash = row.entry_hash;
  }
  return { valid: true, entries: rows.length };
}

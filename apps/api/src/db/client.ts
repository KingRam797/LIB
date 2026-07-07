import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;

export interface DbHandle {
  pool: pg.Pool;
  /**
   * Runs `fn` in a transaction with `app.user_id` set, so Postgres RLS
   * policies scope every query to that user. This is the ONLY sanctioned
   * way to touch user-scoped tables on behalf of a user (T1.3).
   */
  withUserDb<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T>;
  /**
   * Runs `fn` in a transaction with the auth context flag set — used by
   * registration/login/token-refresh, which must look up users before a
   * user identity is established.
   */
  withAuthDb<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

async function withSetting<T>(
  pool: pg.Pool,
  settings: Array<[key: string, value: string]>,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of settings) {
      // set_config with is_local=true scopes the setting to this transaction.
      await client.query("SELECT set_config($1, $2, true)", [key, value]);
    }
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export function createDbHandle(databaseUrl: string): DbHandle {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  return {
    pool,
    withUserDb: (userId, fn) => withSetting(pool, [["app.user_id", userId]], fn),
    withAuthDb: (fn) => withSetting(pool, [["app.auth_context", "on"]], fn),
    end: () => pool.end(),
  };
}

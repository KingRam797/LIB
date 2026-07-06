// DB-agnostic query helper. SQLite local, Postgres prod.
import Database from 'better-sqlite3';
import pg from 'pg';

const client = process.env.DB_CLIENT || 'sqlite';
let sqlite, pool;

if (client === 'pg') {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // An idle pg client emitting 'error' with no listener crashes the process.
  pool.on('error', (e) => console.error('pg pool error', e));
} else {
  sqlite = new Database(process.env.SQLITE_PATH || './server/db/counting_house.db');
  sqlite.pragma('journal_mode = WAL');
}

// Converts ?-style placeholders to $1..$n for pg.
function toPg(sql) { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); }

export async function all(sql, params = []) {
  if (client === 'pg') { const r = await pool.query(toPg(sql), params); return r.rows; }
  return sqlite.prepare(sql).all(...params);
}
export async function get(sql, params = []) {
  if (client === 'pg') { const r = await pool.query(toPg(sql), params); return r.rows[0]; }
  return sqlite.prepare(sql).get(...params);
}
export async function run(sql, params = []) {
  if (client === 'pg') { const r = await pool.query(toPg(sql), params); return r; }
  const stmt = sqlite.prepare(sql);
  return stmt.reader ? stmt.get(...params) : stmt.run(...params);
}
export { client };

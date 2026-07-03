/**
 * SQL migration runner. Runs as the admin/owner role (ADMIN_DATABASE_URL,
 * falling back to DATABASE_URL), applies apps/api/drizzle/*.sql in order,
 * and provisions the RLS-constrained runtime role `spendwhere_app` whose
 * password comes from the APP_DB_PASSWORD secret.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createSecretsProvider } from "@spendwhere/shared";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "drizzle");

export async function runMigrations(adminUrl: string, appDbPassword?: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const { rowCount } = await client.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
      if (rowCount) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }

    if (appDbPassword) {
      await provisionAppRole(client, appDbPassword);
    }
    return applied;
  } finally {
    await client.end();
  }
}

async function provisionAppRole(client: pg.Client, password: string): Promise<void> {
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_roles WHERE rolname = 'spendwhere_app'",
  );
  const escaped = password.replaceAll("'", "''");
  if (!rowCount) {
    await client.query(`CREATE ROLE spendwhere_app LOGIN PASSWORD '${escaped}' NOBYPASSRLS`);
  } else {
    await client.query(`ALTER ROLE spendwhere_app LOGIN PASSWORD '${escaped}' NOBYPASSRLS`);
  }
  const db = (await client.query("SELECT current_database() AS db")).rows[0].db as string;
  await client.query(`GRANT CONNECT ON DATABASE "${db}" TO spendwhere_app`);
  await client.query("GRANT USAGE ON SCHEMA public TO spendwhere_app");
  await client.query(
    "GRANT SELECT, INSERT, UPDATE, DELETE ON users, refresh_tokens, sensitive_profiles, kyc_inquiries TO spendwhere_app",
  );
  // Audit log is append-only for the app role: INSERT + SELECT, never UPDATE/DELETE.
  await client.query("GRANT SELECT, INSERT ON audit_log TO spendwhere_app");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const secrets = createSecretsProvider();
  const adminUrl =
    (await secrets.getOptional("ADMIN_DATABASE_URL")) ?? (await secrets.get("DATABASE_URL"));
  const appDbPassword = await secrets.getOptional("APP_DB_PASSWORD");
  const applied = await runMigrations(adminUrl, appDbPassword);
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "No pending migrations");
}

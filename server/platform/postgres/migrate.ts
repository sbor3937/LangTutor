import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
import { config } from "../../config.js";

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL || config.databaseUrl;
if (!migrationDatabaseUrl) throw new Error("MIGRATION_DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: migrationDatabaseUrl, max: 1 });
try {
  const migrationDirectory = path.resolve("server/platform/postgres/migrations");
  const files = (await fs.readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
  await pool.query("SET ROLE langtutor_owner");
  await pool.query("CREATE SCHEMA IF NOT EXISTS platform AUTHORIZATION langtutor_owner; ALTER SCHEMA platform OWNER TO langtutor_owner; CREATE SCHEMA IF NOT EXISTS identity AUTHORIZATION langtutor_owner; ALTER SCHEMA identity OWNER TO langtutor_owner; CREATE TABLE IF NOT EXISTS platform.schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("GRANT USAGE, CREATE ON SCHEMA identity, platform TO langtutor_authenticator; ALTER DEFAULT PRIVILEGES FOR ROLE langtutor_owner GRANT USAGE, CREATE ON SCHEMAS TO langtutor_authenticator");
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationDirectory, file), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    const existing = await pool.query<{ checksum: string }>("SELECT checksum FROM platform.schema_migrations WHERE name=$1", [file]);
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO platform.schema_migrations(name,checksum) VALUES($1,$2)", [file, checksum]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  console.log("PostgreSQL migrations applied");
} finally {
  try {
    await pool.query("ALTER DEFAULT PRIVILEGES FOR ROLE langtutor_owner REVOKE CREATE ON SCHEMAS FROM langtutor_authenticator; DO $cleanup$ DECLARE item record; BEGIN FOR item IN SELECT nspname FROM pg_namespace WHERE nspowner='langtutor_owner'::regrole LOOP EXECUTE format('REVOKE CREATE ON SCHEMA %I FROM langtutor_authenticator',item.nspname); END LOOP; END $cleanup$");
  } finally {
    await pool.end();
  }
}

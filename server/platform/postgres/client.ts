import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../../config.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export const postgresPool = config.databaseUrl
  ? new Pool({ connectionString: config.databaseUrl, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 })
  : null;

export const postgres = postgresPool ? drizzle(postgresPool, { schema }) : null;

export async function withUserContext<T>(userId: string, familyId: string | null, fn: (client: pg.PoolClient) => Promise<T>) {
  if (!postgresPool) throw new Error("PostgreSQL is not configured");
  const client = await postgresPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.family_id', $2, true)", [userId, familyId ?? ""]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

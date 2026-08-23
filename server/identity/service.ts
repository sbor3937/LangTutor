import crypto from "node:crypto";
import argon2 from "argon2";
import type pg from "pg";
import { config } from "../config.js";
import type { LoginInput, RegisterInput } from "../../shared/identity-schemas.js";

const SESSION_TTL_MS = 15 * 60_000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
const TOKEN_TTL_MS = 30 * 60_000;
const dummyHashPromise = argon2.hash("not-a-real-password-value", { type: argon2.argon2id });

function requirePepper() {
  if (config.sessionPepper.length < 32) throw new Error("SESSION_PEPPER must contain at least 32 characters");
  return config.sessionPepper;
}

export function hashOpaqueToken(token: string) {
  return crypto.createHmac("sha256", requirePepper()).update(token).digest("hex");
}

function opaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}

async function setUserContext(client: pg.PoolClient, userId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.family_id', '', true)", [userId]);
}

export class IdentityService {
  constructor(private readonly pool: pg.Pool) {}

  async register(input: RegisterInput) {
    const client = await this.pool.connect();
    const userId = crypto.randomUUID();
    try {
      await client.query("BEGIN");
      await setUserContext(client, userId);
      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
      await client.query("INSERT INTO identity.users(id,display_name) VALUES($1,$2)", [userId, input.displayName]);
      await client.query("INSERT INTO identity.user_emails(id,user_id,email_normalized,email_display) VALUES($1,$2,$3,$4)", [crypto.randomUUID(), userId, input.email, input.email]);
      await client.query("INSERT INTO identity.credentials(user_id,password_hash) VALUES($1,$2)", [userId, passwordHash]);
      await client.query("INSERT INTO platform.outbox_events(id,user_id,type,payload) VALUES($1,$2,'identity.verification.requested',$3::jsonb)", [crypto.randomUUID(), userId, JSON.stringify({ userId })]);
      await client.query("COMMIT");
      return { userId };
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505") return { userId: null };
      throw error;
    } finally {
      client.release();
    }
  }

  async issueOneTimeToken(userId: string, purpose: "verify_email" | "reset_password") {
    const token = opaqueToken();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await setUserContext(client, userId);
      await client.query("UPDATE identity.one_time_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL", [userId, purpose]);
      await client.query("INSERT INTO identity.one_time_tokens(id,user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)", [crypto.randomUUID(), userId, purpose, hashOpaqueToken(token), new Date(Date.now() + TOKEN_TTL_MS)]);
      await client.query("COMMIT");
      return token;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async verifyEmail(token: string) {
    return this.consumeToken(token, "verify_email", async (client, userId) => {
      await client.query("UPDATE identity.user_emails SET verified_at=COALESCE(verified_at,now()) WHERE user_id=$1", [userId]);
      await client.query("UPDATE identity.users SET status='active',updated_at=now() WHERE id=$1 AND status='pending'", [userId]);
    });
  }

  async requestPasswordReset(email: string) {
    const result = await this.pool.query<{ user_id: string }>("SELECT * FROM identity.lookup_user_by_email($1)", [email]);
    const userId = result.rows[0]?.user_id;
    if (!userId) return;
    await this.withContext(userId, async (client) => {
      await client.query("INSERT INTO platform.outbox_events(id,user_id,type,payload) VALUES($1,$2,'identity.password_reset.requested',$3::jsonb)", [crypto.randomUUID(), userId, JSON.stringify({ userId })]);
    });
  }

  async resetPassword(token: string, password: string) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    return this.consumeToken(token, "reset_password", async (client, userId) => {
      await client.query("UPDATE identity.credentials SET password_hash=$2,password_changed_at=now(),failed_attempts=0,locked_until=NULL WHERE user_id=$1", [userId, passwordHash]);
      await client.query("UPDATE identity.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [userId]);
    });
  }

  private async consumeToken(token: string, purpose: "verify_email" | "reset_password", action: (client: pg.PoolClient, userId: string) => Promise<void>) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const lookup = await client.query<{ user_id: string }>("SELECT user_id FROM identity.lookup_one_time_token($1,$2)", [hashOpaqueToken(token), purpose]);
      const userId = lookup.rows[0]?.user_id;
      if (!userId) { await client.query("ROLLBACK"); return false; }
      await setUserContext(client, userId);
      await action(client, userId);
      await client.query("UPDATE identity.one_time_tokens SET consumed_at=now() WHERE user_id=$1 AND token_hash=$2", [userId, hashOpaqueToken(token)]);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async login(input: LoginInput, userAgent: string | null, ipPrefix: string | null) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ user_id: string; password_hash: string; status: string; verified: boolean; locked_until: Date | null }>("SELECT * FROM identity.lookup_login($1)", [input.email]);
      const row = result.rows[0];
      const valid = await argon2.verify(row?.password_hash ?? await dummyHashPromise, input.password).catch(() => false);
      if (!row) { await client.query("ROLLBACK"); return null; }
      await setUserContext(client, row.user_id);
      if (!valid) {
        await client.query("UPDATE identity.credentials SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts>=9 THEN now()+interval '15 minutes' ELSE locked_until END WHERE user_id=$1", [row.user_id]);
        await client.query("COMMIT");
        return null;
      }
      if (row.status !== "active" || !row.verified || (row.locked_until && row.locked_until > new Date())) { await client.query("ROLLBACK"); return null; }
      await client.query("UPDATE identity.credentials SET failed_attempts=0,locked_until=NULL WHERE user_id=$1", [row.user_id]);
      const token = opaqueToken();
      const refreshToken = opaqueToken();
      const sessionId = crypto.randomUUID();
      await client.query("INSERT INTO identity.sessions(id,user_id,token_hash,user_agent,ip_prefix,expires_at) VALUES($1,$2,$3,$4,$5,$6)", [sessionId, row.user_id, hashOpaqueToken(token), userAgent?.slice(0, 300) ?? null, ipPrefix, new Date(Date.now() + SESSION_TTL_MS)]);
      await client.query("INSERT INTO identity.refresh_tokens(id,user_id,session_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)", [crypto.randomUUID(), row.user_id, sessionId, hashOpaqueToken(refreshToken), new Date(Date.now() + REFRESH_TTL_MS)]);
      await client.query("COMMIT");
      return { token, refreshToken, sessionId, userId: row.user_id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async authenticate(token: string) {
    const result = await this.pool.query<{ user_id: string; session_id: string }>("SELECT * FROM identity.lookup_session($1)", [hashOpaqueToken(token)]);
    return result.rows[0] ?? null;
  }

  async refresh(refreshToken: string, userAgent: string | null, ipPrefix: string | null) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const lookup = await client.query<{ user_id: string; refresh_id: string }>("SELECT * FROM identity.lookup_refresh_token($1)", [hashOpaqueToken(refreshToken)]);
      const current = lookup.rows[0];
      if (!current) { await client.query("ROLLBACK"); return null; }
      await setUserContext(client, current.user_id);
      const sessionToken = opaqueToken(), nextRefreshToken = opaqueToken(), sessionId = crypto.randomUUID(), refreshId = crypto.randomUUID();
      const claimed = await client.query("UPDATE identity.refresh_tokens SET rotated_at=now(),replaced_by=$2 WHERE id=$1 AND rotated_at IS NULL AND revoked_at IS NULL", [current.refresh_id, refreshId]);
      if (claimed.rowCount !== 1) { await client.query("ROLLBACK"); return null; }
      await client.query("INSERT INTO identity.sessions(id,user_id,token_hash,user_agent,ip_prefix,expires_at) VALUES($1,$2,$3,$4,$5,$6)", [sessionId, current.user_id, hashOpaqueToken(sessionToken), userAgent?.slice(0, 300) ?? null, ipPrefix, new Date(Date.now() + SESSION_TTL_MS)]);
      await client.query("INSERT INTO identity.refresh_tokens(id,user_id,session_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)", [refreshId, current.user_id, sessionId, hashOpaqueToken(nextRefreshToken), new Date(Date.now() + REFRESH_TTL_MS)]);
      await client.query("COMMIT");
      return { token: sessionToken, refreshToken: nextRefreshToken, userId: current.user_id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async revokeAll(userId: string) {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); await setUserContext(client, userId); await client.query("UPDATE identity.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [userId]); await client.query("UPDATE identity.refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [userId]); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  private async withContext<T>(userId: string, action: (client: pg.PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); await setUserContext(client, userId); const result = await action(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}

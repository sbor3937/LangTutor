import pg from "pg";
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IdentityService } from "../server/identity/service";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("PostgreSQL identity and FORCE RLS", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
  const service = new IdentityService(pool);
  const runId = crypto.randomUUID();
  const first = { email: `first-${runId}@example.test`, password: "correct horse battery one", displayName: "Первый" };
  const second = { email: `second-${runId}@example.test`, password: "correct horse battery two", displayName: "Второй" };
  let firstId = "";
  let secondId = "";

  beforeAll(async () => {
    firstId = (await service.register(first)).userId!;
    secondId = (await service.register(second)).userId!;
  });
  afterAll(() => pool.end());

  it("verifies email and creates a revocable server session", async () => {
    const verification = await service.issueOneTimeToken(firstId, "verify_email");
    expect(await service.verifyEmail(verification)).toBe(true);
    expect(await service.verifyEmail(verification)).toBe(false);
    const login = await service.login(first, "vitest", "127.0.0");
    expect(login?.userId).toBe(firstId);
    expect(await service.authenticate(login!.token)).toMatchObject({ user_id: firstId });
    const refreshed = await service.refresh(login!.refreshToken, "vitest-refresh", "127.0.0");
    expect(refreshed?.userId).toBe(firstId);
    expect(await service.refresh(login!.refreshToken, "replay", "127.0.0")).toBeNull();
    await service.revokeAll(firstId);
    expect(await service.authenticate(login!.token)).toBeNull();
    expect(await service.refresh(refreshed!.refreshToken, "revoked", "127.0.0")).toBeNull();
  });

  it("returns the same generic registration result for an existing email", async () => {
    expect((await service.register(first)).userId).toBeNull();
  });

  it("resets password once and revokes the previous password", async () => {
    const reset = await service.issueOneTimeToken(firstId, "reset_password");
    const nextPassword = "correct horse battery replacement";
    expect(await service.resetPassword(reset, nextPassword)).toBe(true);
    expect(await service.resetPassword(reset, nextPassword)).toBe(false);
    expect(await service.login(first, "old-password", "127.0.0")).toBeNull();
    expect((await service.login({ ...first, password: nextPassword }, "new-password", "127.0.0"))?.userId).toBe(firstId);
  });

  it("prevents cross-user reads and writes with the runtime role", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.family_id','',true)", [firstId]);
      expect((await client.query("SELECT id FROM identity.users ORDER BY id")).rows).toEqual([{ id: firstId }]);
      expect((await client.query("UPDATE identity.users SET display_name='Нарушение' WHERE id=$1", [secondId])).rowCount).toBe(0);
      await client.query("ROLLBACK");
    } finally { client.release(); }
  });
});

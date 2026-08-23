import crypto from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FamilyService } from "../server/families/service";
import { IdentityService } from "../server/identity/service";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("families, capabilities and migration", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
  const identity = new IdentityService(pool), families = new FamilyService(pool);
  const runId = crypto.randomUUID();
  const password = "correct horse family password";
  const accounts = ["owner-a", "learner", "owner-c"].map((name) => ({ email: `${name}-${runId}@example.test`, password, displayName: name }));
  const ids: string[] = [];
  let familyA = "", familyC = "";

  beforeAll(async () => {
    for (const account of accounts) {
      const id = (await identity.register(account)).userId!; ids.push(id);
      expect(await identity.verifyEmail(await identity.issueOneTimeToken(id, "verify_email"))).toBe(true);
    }
    familyA = (await families.createFamily(ids[0], "Семья A", crypto.randomUUID())).familyId;
    familyC = (await families.createFamily(ids[2], "Семья C", crypto.randomUUID())).familyId;
  });
  afterAll(() => pool.end());

  it("joins by a one-time invitation and enforces capabilities", async () => {
    const owner = { userId: ids[0], sessionId: crypto.randomUUID(), familyId: familyA, role: "owner" as const };
    const invitation = await families.invite(owner, { email: accounts[1].email, role: "member" }, crypto.randomUUID());
    expect(await families.accept(ids[1], invitation.token, password, crypto.randomUUID())).toMatchObject({ to_family_id: familyA });
    const memberContext = await pool.query<{ family_id: string; role: string }>("SELECT * FROM families.active_context($1)", [ids[1]]);
    expect(memberContext.rows[0]).toMatchObject({ family_id: familyA, role: "member" });
    await expect(families.invite({ userId: ids[1], sessionId: crypto.randomUUID(), familyId: familyA, role: "member" }, { email: "blocked@example.test", role: "member" }, crypto.randomUUID())).rejects.toThrow("FORBIDDEN");
  });

  it("moves the learner atomically while preserving user identity", async () => {
    const targetOwner = { userId: ids[2], sessionId: crypto.randomUUID(), familyId: familyC, role: "owner" as const };
    const invitation = await families.invite(targetOwner, { userId: ids[1], role: "member" }, crypto.randomUUID());
    const moved = await families.accept(ids[1], invitation.token, password, crypto.randomUUID());
    expect(moved).toMatchObject({ from_family_id: familyA, to_family_id: familyC });
    expect((await pool.query("SELECT * FROM families.active_context($1)", [ids[1]])).rows[0].family_id).toBe(familyC);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.family_id',$2,true)", [ids[1], familyC]);
      const history = await client.query("SELECT user_id,from_family_id,to_family_id FROM families.membership_history WHERE user_id=$1 ORDER BY moved_at DESC LIMIT 1", [ids[1]]);
      expect(history.rows[0]).toMatchObject({ user_id: ids[1], from_family_id: familyA, to_family_id: familyC });
      await client.query("ROLLBACK");
    } finally { client.release(); }
  });

  it("uses optimistic settings updates and RLS tenant isolation", async () => {
    const owner = { userId: ids[0], sessionId: crypto.randomUUID(), familyId: familyA, role: "owner" as const };
    const values = { aiEnabled: false, allowedModels: [], monthlyTokenLimit: 0, locale: "ru", timezone: "Europe/Moscow", notificationsEnabled: true, aiHistoryRetentionDays: 0 };
    expect((await families.updateSettings(owner, { version: 1, values }, crypto.randomUUID())).version).toBe(2);
    await expect(families.updateSettings(owner, { version: 1, values }, crypto.randomUUID())).rejects.toThrow("VERSION_CONFLICT");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.family_id',$2,true)", [ids[0], familyA]);
      expect((await client.query("SELECT id FROM families.families")).rows).toEqual([{ id: familyA }]);
      expect((await client.query("UPDATE families.families SET name='Нарушение' WHERE id=$1", [familyC])).rowCount).toBe(0);
      await client.query("ROLLBACK");
    } finally { client.release(); }
  });

  it("does not let the only owner abandon a family", async () => {
    const ownerA = { userId: ids[0], sessionId: crypto.randomUUID(), familyId: familyA, role: "owner" as const };
    const invitation = await families.invite(ownerA, { userId: ids[2], role: "admin" }, crypto.randomUUID());
    await expect(families.accept(ids[2], invitation.token, password, crypto.randomUUID())).rejects.toThrow("SOLE_OWNER");
    expect((await pool.query("SELECT * FROM families.active_context($1)", [ids[2]])).rows[0].family_id).toBe(familyC);
    await families.transferOwnership({ userId: ids[2], sessionId: crypto.randomUUID(), familyId: familyC, role: "owner" }, ids[1], crypto.randomUUID());
    expect(await families.accept(ids[2], invitation.token, password, crypto.randomUUID())).toMatchObject({ from_family_id: familyC, to_family_id: familyA });
  });
});

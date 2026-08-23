import crypto from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../server/app";
import { IdentityService } from "../server/identity/service";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("families API", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }), identity = new IdentityService(pool);
  const password = "correct horse api family", runId = crypto.randomUUID();
  const owner = { email: `api-owner-${runId}@example.test`, password, displayName: "Владелец" };
  const member = { email: `api-member-${runId}@example.test`, password, displayName: "Участник" };
  const ownerAgent = request.agent(app), memberAgent = request.agent(app);
  beforeAll(async () => {
    for (const account of [owner, member]) { const id = (await identity.register(account)).userId!; await identity.verifyEmail(await identity.issueOneTimeToken(id, "verify_email")); }
    expect((await ownerAgent.post("/api/v1/auth/login").send(owner)).status).toBe(200);
    expect((await memberAgent.post("/api/v1/auth/login").send(member)).status).toBe(200);
  });
  afterAll(() => pool.end());

  it("creates a family and joins through an invitation without trusting client tenant ids", async () => {
    expect((await ownerAgent.post("/api/v1/families").send({ name: "API семья" })).status).toBe(201);
    const invitation = await ownerAgent.post("/api/v1/families/current/invitations").send({ email: member.email, role: "member" });
    expect(invitation.status).toBe(201);
    const token = new URL(invitation.body.inviteUrl).searchParams.get("token");
    expect((await memberAgent.post("/api/v1/families/invitations/accept").send({ token, password, familyId: crypto.randomUUID() })).status).toBe(200);
    expect((await memberAgent.get("/api/v1/families/current")).body.role).toBe("member");
    expect((await memberAgent.post("/api/v1/families/current/invitations").send({ email: "forbidden@example.test", role: "member" })).status).toBe(403);
  });
});

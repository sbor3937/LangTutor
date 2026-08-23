import pg from "pg";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../server/app";
import { runEmailOutboxOnce } from "../server/worker";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("identity API", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 });
  const credentials = { email: `api-${crypto.randomUUID()}@example.test`, password: "correct horse battery api", displayName: "API пользователь" };
  afterAll(() => pool.end());

  it("registers, verifies, logs in and revokes sessions", async () => {
    expect((await request(app).post("/api/v1/auth/register").send(credentials)).status).toBe(202);
    const lookup = await pool.query<{ user_id: string }>("SELECT * FROM identity.lookup_user_by_email($1)", [credentials.email]);
    let verification = "";
    for (let index = 0; index < 50 && !verification; index += 1) {
      const processed = await runEmailOutboxOnce(async (message) => {
        if (message.to === credentials.email) verification = new URL(message.text.slice(message.text.indexOf("http"))).searchParams.get("token") ?? "";
      });
      if (!processed) break;
    }
    expect(verification.length).toBeGreaterThan(32);
    expect((await request(app).post("/api/v1/auth/verify-email").send({ token: verification })).status).toBe(200);

    const agent = request.agent(app);
    expect((await agent.post("/api/v1/auth/login").send(credentials)).status).toBe(200);
    const current = await agent.get("/api/v1/auth/sessions/current");
    expect(current.status).toBe(200);
    expect(current.body.userId).toBe(lookup.rows[0].user_id);
    expect((await agent.post("/api/v1/auth/refresh")).status).toBe(200);
    expect((await agent.post("/api/v1/auth/logout-all")).status).toBe(204);
    expect((await agent.get("/api/v1/auth/sessions/current")).status).toBe(401);
  });

  it("does not disclose whether an account exists", async () => {
    expect((await request(app).post("/api/v1/auth/request-password-reset").send({ email: "missing@example.test" })).status).toBe(202);
    expect((await request(app).post("/api/v1/auth/request-password-reset").send({ email: credentials.email })).status).toBe(202);
  });
});

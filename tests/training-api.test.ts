import crypto from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../server/app";
import { IdentityService } from "../server/identity/service";
import { LearningService } from "../server/learning/service";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
suite("training scores API", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const identity = new IdentityService(pool);
  const learning = new LearningService(pool);
  const agents = [request.agent(app), request.agent(app)];
  beforeAll(async () => {
    for (const agent of agents) {
      const credentials = { email: `training-${crypto.randomUUID()}@example.test`, password: "correct horse training password", displayName: "Learner" };
      const userId = (await identity.register(credentials)).userId!;
      await identity.verifyEmail(await identity.issueOneTimeToken(userId, "verify_email"));
      await learning.enroll(userId, null, "italian-a0-a1");
      expect((await agent.post("/api/v1/auth/login").send(credentials)).status).toBe(200);
    }
  });
  afterAll(() => pool.end());
  it("requires login and validates the requested course", async () => {
    expect((await request(app).get("/api/v1/learning/training-scores/italian-a0-a1")).status).toBe(401);
    expect((await agents[0].get("/api/v1/learning/training-scores/invalid_course")).status).toBe(400);
  });
  it("returns the signed-in user's grades without exposing another learner's grades", async () => {
    const path = "/api/v1/learning/training-scores/italian-a0-a1";
    expect((await agents[0].get(path)).body).toEqual({ scores: [] });
    expect((await agents[0].post("/api/v1/learning/attempts").send({ courseKey: "italian-a0-a1", lessonKey: "greetings", exerciseKey: "word-1", answer: "Ciao" })).status).toBe(201);
    const scored = await agents[0].get(path);
    expect(scored.status).toBe(200);
    expect(scored.body).toEqual({ scores: [{ lesson_key: "greetings", exercise_key: "word-1", score: 100, attempts: 1 }] });
    expect((await agents[1].get(path)).body).toEqual({ scores: [] });
  });
});

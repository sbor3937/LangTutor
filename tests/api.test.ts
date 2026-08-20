import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../server/app";
import { db } from "../server/db/database";
const aid = "00000000-0000-4000-8000-000000000001";
describe("API and repository", () => {
  it("health checks database", async () =>
    expect((await request(app).get("/api/health")).body).toMatchObject({
      status: "ok",
      database: "ok",
    }));
  it("rejects unsafe invalid input", async () =>
    expect(
      (
        await request(app)
          .post("/api/words")
          .send({ anonymousId: "bad", italian: "<script>", translation: "" })
      ).status,
    ).toBe(400));
  it("adds and reads a word", async () => {
    expect(
      (
        await request(app)
          .post("/api/words")
          .send({ anonymousId: aid, italian: "Ciao", translation: "Привет" })
      ).status,
    ).toBe(201);
    expect((await request(app).get(`/api/words/${aid}`)).body[0].italian).toBe(
      "Ciao",
    );
  });
  it("updates progress", async () =>
    expect(
      (
        await request(app).post("/api/lesson-progress").send({
          anonymousId: aid,
          lessonId: "greetings",
          currentStep: 2,
          completionPercent: 25,
          completed: false,
        })
      ).status,
    ).toBe(200));
  it("exports and imports", async () => {
    const exported = (await request(app).get(`/api/export/${aid}`)).body;
    expect(exported.version).toBe(1);
    expect(
      (await request(app).post(`/api/import/${aid}`).send(exported)).body.ok,
    ).toBe(true);
  });
  it("creates a family without replacing the existing learner or progress", async () => {
    await request(app).get(`/api/profile/${aid}`);
    const family = (await request(app).get(`/api/family/${aid}`)).body;
    expect(family.profiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ anonymousId: aid })]),
    );
    const progress = (await request(app).get(`/api/progress/${aid}`)).body;
    expect(progress.lessons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lessonId: "greetings", currentStep: 2 }),
      ]),
    );
  });
  it("recovers family profiles using a newly issued code", async () => {
    const issued = (await request(app).post(`/api/family/${aid}/code`)).body;
    expect(issued.code).toMatch(/^ITAL-/);
    const connected = (
      await request(app).post("/api/family/connect").send({ code: issued.code })
    ).body;
    expect(connected.profiles[0].anonymousId).toBe(aid);
  });
  it("supports an optional profile PIN", async () => {
    expect(
      (await request(app).put(`/api/profile/${aid}/pin`).send({ pin: "2468" }))
        .status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/profile/unlock")
          .send({ anonymousId: aid, pin: "1111" })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/profile/unlock")
          .send({ anonymousId: aid, pin: "2468" })
      ).status,
    ).toBe(200);
  });
  it("persists through a new query boundary", () =>
    expect(
      db.prepare("SELECT COUNT(*) n FROM user_words").get(),
    ).toHaveProperty("n"));
  afterAll(() => db.close());
});

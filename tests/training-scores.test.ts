import type pg from "pg";
import { expect, it, vi } from "vitest";
import { LearningService } from "../server/learning/service";

it("reads recent word scores in the authenticated user's transaction and enrolled version", async () => {
  const rows = [{ lesson_key: "intro", exercise_key: "word-1", score: 40, attempts: 5 }];
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT e.course_id")) return { rows: [{ course_id: "course", course_version_id: "version" }] };
    if (sql.startsWith("WITH recent")) return { rows };
    return { rows: [] };
  });
  const release = vi.fn();
  const pool = { connect: async () => ({ query, release }) } as unknown as pg.Pool;
  expect(await new LearningService(pool).trainingScores("user", "family", "italian-a0-a1")).toEqual(rows);
  expect(query).toHaveBeenCalledWith("SELECT set_config('app.user_id',$1,true),set_config('app.family_id',$2,true)", ["user", "family"]);
  expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE user_id=$1 AND course_id=$2 AND course_version_id=$3"), ["user", "course", "version"]);
  expect(query).toHaveBeenCalledWith(expect.stringContaining("position<=5"), expect.any(Array));
  expect(query).toHaveBeenCalledWith("COMMIT");
  expect(release).toHaveBeenCalledOnce();
});

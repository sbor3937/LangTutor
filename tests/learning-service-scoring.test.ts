import type pg from "pg";
import { expect, it, vi } from "vitest";
import { LearningService } from "../server/learning/service";

it.each([
  ["en", "I am ten years old.", "I'm 10 years old"],
  ["en", "My favourite subject is English.", "my favorite subject is English"],
  ["it", "Ho dieci anni.", "Ho 10 anni"],
])("persists the language-aware score through LearningService (%s)", async (language, expected, answer) => {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT e.course_id")) return { rows: [{ course_id: "course", course_version_id: "version", language_key: language }] };
    if (sql.startsWith("SELECT e.content")) return { rows: [{ content: { expectedAnswer: expected, skillType: "vocabulary" } }] };
    return { rows: [] };
  });
  const release = vi.fn();
  const pool = { connect: async () => ({ query, release }) } as unknown as pg.Pool;
  const result = await new LearningService(pool).submitAttempt("user", "family", { courseKey: "course", lessonKey: "lesson", exerciseKey: "word-1", answer });
  expect(result).toMatchObject({ score: 100, correct: true });
  const insert = (query.mock.calls as unknown as [string, unknown[]][]).find(([sql]) => sql.startsWith("INSERT INTO learning.exercise_attempts"))!;
  expect(insert[1][1]).toBe("user");
  expect(insert[1][7]).toBe(100);
  expect(insert[1][8]).toBe("Верно");
  expect(query).toHaveBeenCalledWith("COMMIT");
  expect(release).toHaveBeenCalledOnce();
});

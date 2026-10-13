import { describe, expect, it } from "vitest";
import { orderTraining } from "../shared/training-order";

const words = [
  { lessonKey: "first", exerciseKey: "word-1" },
  { lessonKey: "first", exerciseKey: "word-2" },
  { lessonKey: "second", exerciseKey: "word-1" },
  { lessonKey: "second", exerciseKey: "word-2" },
];

describe("training order", () => {
  it("keeps lesson order without mutating the input", () => {
    expect(orderTraining(words, "sequential", [])).toEqual(words);
    expect(orderTraining(words, "sequential", [])).not.toBe(words);
  });
  it("shuffles every word exactly once", () => {
    const shuffled = orderTraining(words, "random", [], () => 0);
    expect(shuffled).not.toEqual(words);
    expect(new Set(shuffled)).toEqual(new Set(words));
    expect(words[0].lessonKey).toBe("first");
    expect(orderTraining([], "random", [])).toEqual([]);
    expect(orderTraining(words.slice(0, 1), "random", [])).toEqual(words.slice(0, 1));
  });
  it("puts untested and weaker words first, keeping lessons separate and ties stable", () => {
    expect(orderTraining(words, "weak-first", [
      { lesson_key: "first", exercise_key: "word-1", score: 100, attempts: 5 },
      { lesson_key: "first", exercise_key: "word-2", score: 20, attempts: 2 },
      { lesson_key: "second", exercise_key: "word-1", score: 0, attempts: 1 },
    ])).toEqual([words[3], words[2], words[1], words[0]]);
    expect(orderTraining(words, "weak-first", [])).toEqual(words);
  });
});

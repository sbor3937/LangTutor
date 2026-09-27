import { describe, expect, it } from "vitest";
import { scoreAnswer } from "../shared/answer-scoring";
import { contentPacks } from "../content/registry";

describe("translation answers from the reported screenshots", () => {
  it.each([
    ["I am ten years old.", "I'm 10 years old", "en"],
    ["My favourite subject is English.", "my favorite subject is English", "en"],
    ["I have got a younger sister.", "I've got a younger sister", "en"],
    ["I have got a younger sister.", "I have a younger sister", "en"],
    ["I can ride a bike.", "I can ride a bike", "en"],
    ["We are good friends.", "we are good friends", "en"],
    ["Ho dieci anni.", "Ho 10 anni!", "it"],
    ["un’acqua", "un'acqua", "it"],
    ["Ciao", "ciao!", "it"],
  ])("accepts %s / %s", (expected, actual, language) => {
    expect(scoreAnswer(expected, actual, language)).toMatchObject({ score: 100, correct: true });
  });
  it.each([
    ["I have got a younger sister.", "I have got the younger sister", "en"],
    ["I am ten years old.", "I am eleven years old.", "en"],
    ["I can ride a bike.", "I cannot ride a bike.", "en"],
    ["Non mi piace il formaggio.", "Mi piace il formaggio.", "it"],
    ["point out", "out point", "en"],
  ])("does not accept meaning or grammar changes: %s / %s", (expected, actual, language) => {
    const result = scoreAnswer(expected, actual, language);
    expect(result.correct).toBe(false);
    expect(result.score).toBeLessThan(80);
    expect(result.feedback).toContain(expected);
  });
  it("gives partial credit and a concrete correction instead of an unexplained zero", () => {
    const result = scoreAnswer("I have got a younger sister.", "I have got the younger sister", "en");
    expect(result.score).toBeGreaterThan(0);
    expect(result.feedback).toContain("артикли");
  });
});

describe("card-level content", () => {
  it("provides translated examples and at least three missions for every published card", () => {
    const words = contentPacks.flatMap(pack => pack.lessons.flatMap(lesson => lesson.words));
    expect(words).toHaveLength(328);
    for (const word of words) {
      expect(word.exampleTranslation, word.target).toMatch(/[а-яё]/i);
      expect(word.conversation?.length, word.target).toBeGreaterThanOrEqual(3);
      expect(new Set(word.conversation?.map(prompt => prompt.question)).size).toBe(word.conversation?.length);
    }
  });
  it("keeps point out missions about point out, not other cards", () => {
    const lesson = contentPacks.find(pack => pack.courseKey === "english-phrasal-verbs-a2-b1")!.lessons.find(lesson => lesson.id === "communication")!;
    const word = lesson.words.find(word => word.target === "point out")!;
    expect(word.exampleTranslation).toBe("Она указала на ошибку.");
    expect(word.conversation).toHaveLength(4);
    for (const prompt of word.conversation!) expect(prompt.question).toContain("point");
    expect(lesson.words.find(word => word.target === "find out")!.exampleTranslation).toBe("Давайте выясним, что произошло.");
  });
});

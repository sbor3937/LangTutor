import { describe, expect, it, vi } from "vitest";
import { KodikRouterTutorProvider } from "../server/ai/providers/openrouter";
import { selectTutorModel } from "../server/ai/model-selection";
import { contentPacks } from "../content/registry";

const input = { message: "Please hand in your homework.", language: "en" as const, question: "Ask students to hand in homework.", scenario: "intro", history: [], unlockedLessonIds: [], model: "openai/gpt-4.1-nano", maxOutputTokens: 800 };
describe("KodikRouter", () => {
  it("uses its own endpoint, key, exact model and usage accounting", async () => {
    const data = { replyItalian: "Well done!", replyRussian: "Хорошо!", original: input.message, corrected: input.message, explanationRu: "Верно", naturalVariant: null, nextQuestion: "When is it due?", scenario: "intro", level: "A1" };
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) } }], usage: { prompt_tokens: 25, completion_tokens: 30 } })));
    const result = await new KodikRouterTutorProvider(fetcher as never, "test-kodik-key").complete(input);
    const [url, init] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0];
    expect(url).toBe("https://api.kodikrouter.ru/v1/chat/completions");
    expect(init.redirect).toBe("error");
    expect(init.headers).toMatchObject({ authorization: "Bearer test-kodik-key" });
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "openai/gpt-4.1-nano", response_format: { type: "json_object" } });
    expect(result.usage).toMatchObject({ promptTokens: 25, completionTokens: 30 });
    expect(result.data.corrected).toBe(input.message);
  });
  it("does not call upstream without a key", async () => {
    const fetcher = vi.fn();
    await expect(new KodikRouterTutorProvider(fetcher as never, "").complete(input)).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves safe upstream errors", async () => {
    const fetcher = vi.fn(async () => new Response("private provider details", { status: 429 }));
    await expect(new KodikRouterTutorProvider(fetcher as never, "test-key").complete(input)).rejects.toMatchObject({ code: "UPSTREAM_RATE_LIMIT", retryable: true });
  });
  it("does not silently switch to another provider or activate live requests", () => {
    const settings = { liveAI: true, aiModelKey: "kodikrouter/gpt-4.1-nano", kodikrouterKey: "kodik", openrouterKey: "openrouter" };
    expect(selectTutorModel(settings)).toBe(settings.aiModelKey);
    expect(selectTutorModel({ ...settings, liveAI: false })).toBe("demo/italian-a0");
    expect(selectTutorModel({ ...settings, kodikrouterKey: "" })).toBe("demo/italian-a0");
    expect(selectTutorModel({ ...settings, aiModelKey: "openrouter/gpt-4.1-mini" })).toBe("openrouter/gpt-4.1-mini");
  });
});

describe("specific conversation missions", () => {
  const words = contentPacks.flatMap(pack => pack.lessons.flatMap(lesson => lesson.words));
  it("provides four concrete English homework situations for hand in", () => {
    const prompts = words.find(word => word.target === "hand in")!.conversation!;
    expect(prompts).toHaveLength(4);
    expect(prompts[0].question).toBe("You are a teacher. Ask your students to hand in their homework politely.");
    for (const prompt of prompts) {
      expect(prompt.question).not.toMatch(/[а-яё]/i);
      expect(prompt.question).toMatch(/hand(?:ed)? (?:it )?in/);
    }
  });
  it("removes the identical translation heading in both languages", () => {
    for (const word of words) for (const prompt of word.conversation!) {
      expect(prompt.question).not.toContain("sentence in the hint");
      expect(prompt.question).not.toBe("Come si dice in italiano?");
    }
  });
});

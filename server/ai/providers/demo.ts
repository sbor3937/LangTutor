import { demoTutor } from "../../services/tutor.js";
import type { TutorProvider, TutorProviderInput } from "../types.js";

export class DemoTutorProvider implements TutorProvider {
  readonly key = "demo";
  async complete(input: TutorProviderInput) {
    if (input.language === "en") return {
      data: {
        replyItalian: "Try answering the question in your own words.",
        replyRussian: "Попробуйте ответить своими словами.",
        original: input.message, corrected: input.message,
        explanationRu: "Деморежим: смысл и грамматика не проверены. Для проверки нужна доступная модель ИИ в настройках семьи. Сравните ответ с подсказкой; совпадение с образцом не обязательно.",
        naturalVariant: null, nextQuestion: input.question ?? "What do you do every day?",
        scenario: input.scenario, level: "A1" as const,
      },
      usage: { promptTokens: 0, completionTokens: 0, cachedTokens: 0, reasoningTokens: 0 },
    };
    return { data: demoTutor(input.message, input.scenario, input.history), usage: { promptTokens: 0, completionTokens: 0, cachedTokens: 0, reasoningTokens: 0 } };
  }
}

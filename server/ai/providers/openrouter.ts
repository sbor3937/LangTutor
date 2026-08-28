import { fetch as undiciFetch, ProxyAgent } from "undici";
import { z } from "zod";
import { tutorResponseSchema } from "../../../shared/schemas.js";
import { config } from "../../config.js";
import { AiProviderError, type TutorProvider, type TutorProviderInput } from "../types.js";

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative().default(0),
    completion_tokens: z.number().int().nonnegative().default(0),
    prompt_tokens_details: z.object({ cached_tokens: z.number().int().nonnegative().optional() }).optional(),
    completion_tokens_details: z.object({ reasoning_tokens: z.number().int().nonnegative().optional() }).optional(),
  }).default({ prompt_tokens: 0, completion_tokens: 0 }),
});

type Fetcher = typeof undiciFetch;
export class OpenRouterTutorProvider implements TutorProvider {
  readonly key = "openrouter";
  private readonly dispatcher = config.proxyUrl ? new ProxyAgent(config.proxyUrl) : undefined;
  constructor(private readonly fetcher: Fetcher = undiciFetch, private readonly apiKey = config.openrouterKey) {}
  async complete(input: TutorProviderInput) {
    if (!this.apiKey) throw new AiProviderError("PROVIDER_NOT_CONFIGURED", false);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), config.aiTimeoutMs);
    try {
      const response = await this.fetcher(`${config.openrouterBase}/chat/completions`, {
        method: "POST", signal: controller.signal, dispatcher: this.dispatcher,
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json", "HTTP-Referer": config.appUrl, "X-Title": "LangTutor" },
        body: JSON.stringify({ model: input.model, temperature: 0.65, max_tokens: input.maxOutputTokens, response_format: { type: "json_object" }, messages: [
          { role: "system", content: `Ты терпеливый репетитор итальянского A0 для русскоязычного ученика. Сценарий: ${input.scenario}. Изученные уроки: ${input.unlockedLessonIds.join(", ") || "нет"}. Ответь только JSON с полями replyItalian, replyRussian, original, corrected, explanationRu, naturalVariant, nextQuestion, scenario, level. Не запрашивай персональные данные.` },
          ...input.history.slice(-10).map((turn) => ({ role: turn.role, content: turn.text })), { role: "user", content: input.message },
        ] }),
      });
      if (!response.ok) throw new AiProviderError(response.status === 429 ? "UPSTREAM_RATE_LIMIT" : response.status >= 500 ? "UPSTREAM_UNAVAILABLE" : "UPSTREAM_REJECTED", response.status === 429 || response.status >= 500);
      const body = responseSchema.parse(await response.json());
      const data = tutorResponseSchema.parse(JSON.parse(body.choices[0].message.content));
      return { data, usage: { promptTokens: body.usage.prompt_tokens, completionTokens: body.usage.completion_tokens, cachedTokens: body.usage.prompt_tokens_details?.cached_tokens ?? 0, reasoningTokens: body.usage.completion_tokens_details?.reasoning_tokens ?? 0 } };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new AiProviderError("UPSTREAM_TIMEOUT", true);
      throw new AiProviderError(error instanceof SyntaxError || error instanceof z.ZodError ? "UPSTREAM_INVALID_RESPONSE" : "UPSTREAM_FAILURE", false);
    } finally { clearTimeout(timer); }
  }
}

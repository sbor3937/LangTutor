import type { TutorResponse } from "../../shared/schemas.js";

export type TutorTurn = { role: "user" | "assistant"; text: string };
export type TutorProviderInput = { message: string; scenario: string; history: TutorTurn[]; unlockedLessonIds: string[]; model: string; maxOutputTokens: number };
export type TokenUsage = { promptTokens: number; completionTokens: number; cachedTokens: number; reasoningTokens: number };
export type TutorProviderResult = { data: TutorResponse; usage: TokenUsage };
export interface TutorProvider { readonly key: string; complete(input: TutorProviderInput): Promise<TutorProviderResult>; }
export type ReservedModel = { modelId: string; modelKey: string; providerKey: string; upstreamModel: string; maxOutputTokens: number; priceVersionId: string; promptRate: string; completionRate: string };

export class AiPolicyError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "AiPolicyError"; }
}
export class AiProviderError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) { super(code); this.name = "AiProviderError"; }
}

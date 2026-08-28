import { demoTutor } from "../../services/tutor.js";
import type { TutorProvider, TutorProviderInput } from "../types.js";

export class DemoTutorProvider implements TutorProvider {
  readonly key = "demo";
  async complete(input: TutorProviderInput) {
    return { data: demoTutor(input.message, input.scenario, input.history), usage: { promptTokens: 0, completionTokens: 0, cachedTokens: 0, reasoningTokens: 0 } };
  }
}

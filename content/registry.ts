import { lessons } from "./italian/a0-a1/v1/index.js";

export const contentPacks = [{
  languageKey: "it",
  programKey: "italian-general",
  courseKey: "italian-a0-a1",
  version: 1,
  sourceLocale: "ru",
  targetLocale: "it-IT",
  cefr: ["A0", "A1"],
  lessons,
}] as const;

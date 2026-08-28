import { lessons } from "./italian/a0-a1/v1/index.js";
import { englishCoreLessons } from "./english/core/v1/index.js";
import { phrasalVerbLessons } from "./english/phrasal-verbs/v1/index.js";
import { chinesePlannedPack } from "./chinese/manifest.js";
import type {ContentPack} from "./types.js";

const common={sourceLocale:"ru",prerequisites:[],skills:["vocabulary","reading","listening","writing","speaking","grammar","conversation"],scoringPolicy:{key:"deterministic-mastery",version:1},unlockRules:{kind:"linear" as const}};
export const contentPacks:ContentPack[] = [{
  languageKey: "it",
  languageName: "Итальянский",
  programKey: "italian-general",
  programName: "Итальянский для русскоязычных",
  courseKey: "italian-a0-a1",
  courseName: "Итальянский A0–A1",
  version: 1,
  targetLocale: "it-IT",
  cefr: ["A0", "A1"],
  ...common,aiScenarios:["intro","cafe","ticket","hotel","time","food","shopping","directions","help","home","routine","weather","health","plans"],
  lessons:lessons.map(lesson=>({...lesson,words:lesson.words.map(word=>({target:word.it,source:word.ru,example:word.example,hint:word.hint}))})),
},{languageKey:"en",languageName:"Английский",programKey:"english-general",programName:"Английский для русскоязычных",courseKey:"english-core-a0-a1",courseName:"English Core A0–A1",version:1,targetLocale:"en-GB",cefr:["A0","A1"],...common,aiScenarios:["introductions","daily-life","travel","plans"],lessons:englishCoreLessons},
{languageKey:"en",languageName:"Английский",programKey:"english-phrasal-verbs",programName:"English Phrasal Verbs",courseKey:"english-phrasal-verbs-a2-b1",courseName:"Phrasal Verbs A2–B1",version:1,targetLocale:"en-GB",cefr:["A2","B1"],...common,prerequisites:["english-core-a0-a1"],skills:["vocabulary","reading","listening","writing","conversation"],aiScenarios:["phrasal-verbs-context","phrasal-verbs-dialogue"],lessons:phrasalVerbLessons}];
export const plannedContentPacks=[chinesePlannedPack] as const;

import { z } from "zod";
export const goalSchema = z.enum([
  "travel",
  "communication",
  "relocation",
  "work",
  "self",
]);
export const profileSchema = z.object({
  anonymousId: z.string().uuid(),
  name: z.string().trim().max(80).optional().default(""),
  learningGoal: goalSchema.default("travel"),
  dailyMinutes: z
    .union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)])
    .default(15),
  initialLevel: z.enum(["zero", "words", "previous"]).default("zero"),
  weeklyGoal: z.number().int().min(1).max(7).default(5),
});
export const wordInputSchema = z.object({
  anonymousId: z.string().uuid(),
  italian: z.string().trim().min(1).max(100),
  translation: z.string().trim().min(1).max(200),
  exampleItalian: z.string().max(300).optional(),
  exampleRussian: z.string().max(300).optional(),
  lessonId: z.string().max(50).optional(),
});
export const progressSchema = z.object({
  anonymousId: z.string().uuid(),
  lessonId: z.string().min(1).max(50),
  currentStep: z.number().int().min(0).max(20),
  completionPercent: z.number().int().min(0).max(100),
  completed: z.boolean().default(false),
  score: z.number().min(0).max(100).optional(),
});
export const attemptSchema = z.object({
  anonymousId: z.string().uuid(),
  lessonId: z.string().max(50),
  exerciseId: z.string().max(80),
  skillType: z.enum([
    "listening",
    "pronunciation",
    "reading",
    "writing",
    "quiz",
  ]),
  score: z.number().min(0).max(100),
  targetText: z.string().max(500).optional(),
  recognizedText: z.string().max(500).optional(),
  feedback: z.string().max(1000).optional(),
});
export const examSubmissionSchema = z.object({
  anonymousId: z.string().uuid(),
  answers: z.array(z.string().trim().min(1).max(300)).length(10),
});
export const tutorRequestSchema = z.object({
  anonymousId: z.string().uuid(),
  message: z.string().trim().min(1).max(800),
  scenario: z
    .enum(["intro", "cafe", "ticket", "hotel", "time", "food", "shopping", "directions", "help", "home", "routine", "weather", "health", "plans"])
    .default("intro"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(1000),
      }),
    )
    .max(12)
    .default([]),
});
export const tutorResponseSchema = z.object({
  replyItalian: z.string(),
  replyRussian: z.string(),
  original: z.string(),
  corrected: z.string(),
  explanationRu: z.string(),
  naturalVariant: z.string().nullable(),
  nextQuestion: z.string(),
  scenario: z.string(),
  level: z.enum(["A0", "A1"]).catch("A0"),
});
export const importSchema = z.object({
  version: z.literal(1),
  profile: z.record(z.unknown()).nullable(),
  words: z.array(z.record(z.unknown())).max(5000),
  progress: z.array(z.record(z.unknown())).max(1000),
  attempts: z.array(z.record(z.unknown())).max(10000),
});
export const familyConnectSchema = z.object({
  code: z.string().trim().min(16).max(40),
});
export const familyAttachSchema = z.object({
  anonymousIds: z.array(z.string().uuid()).min(1).max(10),
});
export const profilePinSchema = z.object({
  pin: z.union([z.string().regex(/^\d{4,8}$/), z.literal("")]),
});
export const profileUnlockSchema = z.object({
  anonymousId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,8}$/),
});
export type ProfileInput = z.infer<typeof profileSchema>;
export type TutorResponse = z.infer<typeof tutorResponseSchema>;

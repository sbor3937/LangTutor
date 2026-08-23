import { z } from "zod";

export const enrollmentSchema=z.object({courseKey:z.string().min(1).max(100)});
export const learningProgressSchema=z.object({courseKey:z.string().min(1).max(100),lessonKey:z.string().min(1).max(80),currentStep:z.number().int().min(0).max(100),completionPercent:z.number().int().min(0).max(100),completed:z.boolean(),version:z.number().int().min(0)});
export const learningAttemptSchema=z.object({courseKey:z.string().min(1).max(100),lessonKey:z.string().min(1).max(80),exerciseKey:z.string().min(1).max(100),answer:z.string().trim().min(1).max(500)});
export const vocabularyInputSchema=z.object({courseKey:z.string().min(1).max(100),term:z.string().trim().min(1).max(100),translation:z.string().trim().min(1).max(200),lessonKey:z.string().max(80).optional()});

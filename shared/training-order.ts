import { z } from "zod";

export const trainingOrderSchema = z.enum(["sequential", "random", "weak-first"]);
export type TrainingOrder = z.infer<typeof trainingOrderSchema>;
export const trainingScoresSchema = z.object({ scores: z.array(z.object({
  lesson_key: z.string(),
  exercise_key: z.string(),
  score: z.number().min(0).max(100),
  attempts: z.number().int().min(1),
})) });
export type TrainingScore = z.infer<typeof trainingScoresSchema>["scores"][number];

export function orderTraining<T extends { lessonKey: string; exerciseKey: string }>(
  exercises: readonly T[], order: TrainingOrder, scores: readonly TrainingScore[], random = Math.random,
): T[] {
  const result = [...exercises];
  if (order === "random") {
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
  } else if (order === "weak-first") {
    const ratings = new Map(scores.map(item => [JSON.stringify([item.lesson_key, item.exercise_key]), item]));
    const rating = (item: T) => ratings.get(JSON.stringify([item.lessonKey, item.exerciseKey]));
    result.sort((a, b) => (rating(a)?.score ?? 0) - (rating(b)?.score ?? 0)
      || (rating(a)?.attempts ?? 0) - (rating(b)?.attempts ?? 0));
  }
  return result;
}

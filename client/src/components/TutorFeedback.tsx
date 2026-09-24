import { z } from "zod";
import { tutorResponseSchema } from "../../../shared/schemas";

export const tutorFeedbackSchema = tutorResponseSchema.extend({ mode: z.enum(["live", "demo", "fallback"]) });
export type TutorFeedbackData = z.infer<typeof tutorFeedbackSchema>;

export function TutorFeedback({ result }: { result: TutorFeedbackData }) {
  return <div role="status" aria-live="polite" className="translation">
    <h3>{result.mode === "live" ? "Результат проверки" : "Деморежим — ответ не проверен ИИ"}</h3>
    {result.mode === "live" ? <><p><strong>Ваш ответ с исправлениями:</strong> {result.corrected}</p><p>{result.explanationRu}</p></>
      : <p>Полная проверка смысла и грамматики сейчас недоступна. Проверьте настройки ИИ семьи или повторите позже. Демонстрационная подсказка не подтверждает правильность ответа.</p>}
  </div>;
}

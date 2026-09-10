import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ConversationPractice } from "./ConversationPractice";

const courseSchema = z.object({ name: z.string(), metadata: z.object({ targetLocale: z.string().optional() }).optional(), lessons: z.array(z.object({
  lesson_key: z.string(), title: z.string(), content: z.object({ goal: z.string(), explanation: z.string(), words: z.array(z.object({ example: z.string() })), conversation: z.array(z.object({ question: z.string(), modelAnswer: z.string(), tip: z.string() })).optional() }),
})) });
export function GuidedEnglishTutor({ courseKey }: { courseKey: string }) {
  const [selected, setSelected] = useState("");
  const course = useQuery({ queryKey: ["guided-tutor-course", courseKey], queryFn: async () => {
    const response = await fetch(`/api/v1/learning/courses/${encodeURIComponent(courseKey)}`, { credentials: "include" });
    if (!response.ok) throw new Error("Не удалось загрузить задания");
    return courseSchema.parse(await response.json());
  } });
  if (course.isLoading) return <section className="page"><p role="status">Загружаем разговорные задания…</p></section>;
  if (!course.data) return <section className="page"><p role="alert">Не удалось загрузить задания.</p><button onClick={() => void course.refetch()}>Повторить</button></section>;
  const lesson = course.data.lessons.find(item => item.lesson_key === selected) ?? course.data.lessons[0];
  return <section className="page"><p className="eyebrow">{course.data.name}</p><h1>Репетитор: разговорная практика</h1>
    <p className="lead">Готовые вопросы и подсказки для самостоятельной тренировки или занятия со взрослым. Это не свободный AI-чат: автоматической оценки открытых ответов здесь нет.</p>
    <label>Тема занятия<select value={lesson?.lesson_key ?? ""} onChange={event => setSelected(event.target.value)}>{course.data.lessons.map(item => <option key={item.lesson_key} value={item.lesson_key}>{item.title}</option>)}</select></label>
    {lesson && <><p>{lesson.content.explanation}</p><ConversationPractice key={courseKey + lesson.lesson_key} locale={course.data.metadata?.targetLocale ?? "en-GB"} prompts={lesson.content.conversation ?? [{ question: lesson.content.goal, modelAnswer: lesson.content.words[0]?.example ?? "", tip: "Используйте фразы урока и добавьте свои детали." }]} /></>}
  </section>;
}

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

type Word = { target: string; source: string; example: string; hint: string };
type Lesson = { lesson_key: string; title: string; position: number; content: { goal: string; minutes: number; explanation: string; words: Word[] } };
type Course = { key: string; name: string; language_name: string; course_version_id: string; lessons: Lesson[] };
type Progress = { course_version_id: string; lesson_key: string; current_step: number; completion_percent: number; completed: boolean; score: number | null; version: number };

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/learning${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? "Не удалось сохранить учебный результат");
  return body as T;
}

export function InternetCoursePage() {
  const { courseKey = "" } = useParams();
  const queryClient = useQueryClient();
  const [selectedLesson, setSelectedLesson] = useState<string>();
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("Введите перевод и проверьте себя");
  const course = useQuery({ queryKey: ["internet-course", courseKey], queryFn: () => request<Course>(`/courses/${courseKey}`), enabled: Boolean(courseKey) });
  const progress = useQuery({ queryKey: ["internet-progress"], queryFn: () => request<{ lessons: Progress[] }>("/progress") });
  const records = useMemo(() => (progress.data?.lessons ?? []).filter((item) => item.course_version_id === course.data?.course_version_id), [course.data?.course_version_id, progress.data?.lessons]);
  const lesson = course.data?.lessons.find((item) => item.lesson_key === selectedLesson) ?? course.data?.lessons[0];
  const record = records.find((item) => item.lesson_key === lesson?.lesson_key);
  const attempt = useMutation({ mutationFn: () => request<{ score: number; correct: boolean; feedback: string }>("/attempts", { method: "POST", body: JSON.stringify({ courseKey, lessonKey: lesson!.lesson_key, exerciseKey: "word-1", answer }) }), onSuccess: (result) => setFeedback(`${result.feedback}. Результат: ${result.score} из 100.`), onError: (error) => setFeedback((error as Error).message) });
  const save = useMutation({ mutationFn: () => request<Progress>("/progress", { method: "PUT", body: JSON.stringify({ courseKey, lessonKey: lesson!.lesson_key, currentStep: lesson!.content.words.length, completionPercent: 100, completed: true, version: record?.version ?? 0 }) }), onSuccess: async () => { setFeedback("Урок завершён. Прогресс сохранён в вашем аккаунте."); await queryClient.invalidateQueries({ queryKey: ["internet-progress"] }); }, onError: (error) => setFeedback((error as Error).message) });
  function submit(event: FormEvent) { event.preventDefault(); if (lesson && answer.trim()) attempt.mutate(); }
  if (course.isLoading || progress.isLoading) return <section className="page"><h1>Курс</h1><p role="status">Загружаем уроки и прогресс…</p></section>;
  if (course.error || progress.error || !course.data || !lesson) return <section className="page"><h1>Курс недоступен</h1><p role="alert">Войдите в аккаунт и выберите программу.</p><Link className="button primary" to="/auth">Войти</Link></section>;
  const firstWord = lesson.content.words[0];
  return <section className="page internet-course"><p className="eyebrow">{course.data.language_name} · интернет-курс</p><h1>{course.data.name}</h1><div className="course-layout"><nav className="lesson-index" aria-label="Уроки курса">{course.data.lessons.map((item) => { const saved = records.find((entry) => entry.lesson_key === item.lesson_key); return <button type="button" className={item.lesson_key === lesson.lesson_key ? "selected" : ""} key={item.lesson_key} onClick={() => { setSelectedLesson(item.lesson_key); setAnswer(""); setFeedback("Введите перевод и проверьте себя"); }}><span>{item.position}. {item.title}</span><small>{saved?.completed ? "Завершён" : saved ? `${saved.completion_percent}%` : "Не начат"}</small></button>; })}</nav><article className="card lesson-workspace"><p>{lesson.content.minutes} минут</p><h2>{lesson.title}</h2><p className="lead">{lesson.content.goal}</p><p>{lesson.content.explanation}</p><h3>Слова и фразы</h3><div className="word-list">{lesson.content.words.map((word) => <div key={word.target}><b>{word.target}</b><span>{word.source}</span><small>{word.example}</small></div>)}</div>{firstWord && <form aria-label="Проверка знания" onSubmit={submit}><label>{firstWord.source}<input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Ответ на изучаемом языке" required maxLength={500} /></label><button className="button secondary" type="submit" disabled={attempt.isPending}>Проверить ответ</button></form>}<p className="feedback" role="status" aria-live="polite">{feedback}</p><button className="button primary" type="button" disabled={save.isPending || record?.completed} onClick={() => save.mutate()}>{record?.completed ? "Урок завершён" : "Завершить урок"}</button></article></div></section>;
}

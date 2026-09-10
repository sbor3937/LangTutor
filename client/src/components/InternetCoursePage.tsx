import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronLeft, Headphones, Mic, Plus, Volume2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { LessonVoiceInput } from "./LessonVoiceInput";
import { ConversationPractice } from "./ConversationPractice";
import type { ConversationPrompt } from "../../../content/types";
import { CourseOverview } from "./CourseOverview";
import { tts } from "../lib/speech";

type Word = { target: string; source: string; example: string; hint: string };
type Lesson = { lesson_key: string; title: string; position: number; content: { goal: string; minutes: number; explanation: string; practices: string[]; conversation?: ConversationPrompt[]; words: Word[] } };
type Course = { key: string; name: string; language_name: string; language_key: string; metadata?: { targetLocale?: string }; course_version_id: string; lessons: Lesson[] };
type Progress = { course_version_id: string; lesson_key: string; current_step: number; completion_percent: number; completed: boolean; score: number | null; version: number };
type Attempt = { score: number; correct: boolean; feedback: string };

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/learning${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? "Не удалось сохранить учебный результат");
  return body as T;
}
function speak(text: string, lang = "it-IT", rate = 0.9) { return tts.speak(text, { lang, rate }).catch(() => undefined); }
function useCourse(courseKey: string) {
  const course = useQuery({ queryKey: ["internet-course", courseKey], staleTime: 300000, queryFn: () => request<Course>(`/courses/${courseKey}`), enabled: Boolean(courseKey) });
  const progress = useQuery({ queryKey: ["internet-progress"], queryFn: () => request<{ lessons: Progress[] }>("/progress") });
  return { course, progress };
}

export function InternetCoursePage() {
  const { courseKey = "" } = useParams();
  const { course, progress } = useCourse(courseKey);
  if (course.isLoading || progress.isLoading) return <section className="page"><h1>Курс</h1><p role="status">Загружаем уроки и прогресс…</p></section>;
  if (!course.data) return <section className="page"><h1>Курс недоступен</h1><Link className="button primary" to="/programs">К программам</Link></section>;
  const records = (progress.data?.lessons ?? []).filter((item) => item.course_version_id === course.data.course_version_id);
  return <CourseOverview courseKey={courseKey} name={course.data.name} language={course.data.language_name} lessons={course.data.lessons} progress={records} />;
}

type Stage = "cards" | "listening" | "pronunciation" | "quiz";
const stageLabels: Array<[Stage, string]> = [["cards", "Карточки"], ["listening", "Аудирование"], ["pronunciation", "Произношение"], ["quiz", "Проверка"]];

export function InternetLessonPage() { const params = useParams(); return <LessonSession key={params.courseKey + ":" + params.lessonKey} />; }
function LessonSession() {
  const { courseKey = "", lessonKey = "" } = useParams();
  const queryClient = useQueryClient(), { course, progress } = useCourse(courseKey);
  const [stage, setStage] = useState<Stage>("cards"), [index, setIndex] = useState(0), [show, setShow] = useState(false);
  const [answer, setAnswer] = useState(""), [feedback, setFeedback] = useState(""), [busy, setBusy] = useState(false), [quizPoints, setQuizPoints] = useState(0);
  const [localVersion, setLocalVersion] = useState<number | null>(null);
  useEffect(() => () => { tts.stop(); }, []);
  const lesson = course.data?.lessons.find((item) => item.lesson_key === lessonKey);
  const record = progress.data?.lessons.find((item) => item.course_version_id === course.data?.course_version_id && item.lesson_key === lessonKey);
  useEffect(() => { if (record && lesson && localVersion === null) { setLocalVersion(record.version); setIndex(record.completed ? 0 : Math.min(record.current_step, Math.max((lesson?.content.words.length ?? 1) - 1, 0))); } }, [lesson, localVersion, record]);
  if (course.isLoading || progress.isLoading) return <section className="page"><h1>Урок</h1><p role="status">Готовим урок…</p></section>;
  if (!course.data || !lesson) return <section className="page"><h1>Урок не найден</h1><Link to={`/programs/${courseKey}`}>Вернуться к программе</Link></section>;
  const words = lesson.content.words, word = words[index], targetLocale = course.data.metadata?.targetLocale ?? (course.data.language_key === "it" ? "it-IT" : "en-GB");
  async function saveProgress(completionPercent: number, completed = false, step = index) { const saved = await request<Progress>("/progress", { method: "PUT", body: JSON.stringify({ courseKey, lessonKey, currentStep: step, completionPercent, completed, version: localVersion ?? record?.version ?? 0 }) }); setLocalVersion(saved.version); await queryClient.invalidateQueries({ queryKey: ["internet-progress"] }); }
  async function addWord() { setBusy(true); try { await request("/vocabulary", { method: "POST", body: JSON.stringify({ courseKey, lessonKey, term: word.target, translation: word.source }) }); setFeedback(`«${word.target}» добавлено в «Мои слова».`); } catch (error) { setFeedback((error as Error).message); } finally { setBusy(false); } }
  async function nextCard() { const next = Math.min(index + 1, words.length - 1); setBusy(true); try { await saveProgress(Math.round(((next + 1) / words.length) * 60), false, next); if (index === words.length - 1) { setStage("listening"); setIndex(0); } else setIndex(next); setShow(false); setAnswer(""); setFeedback(""); } catch (error) { setFeedback((error as Error).message); } finally { setBusy(false); } }
  async function submitAttempt(value: string) { return request<Attempt>("/attempts", { method: "POST", body: JSON.stringify({ courseKey, lessonKey, exerciseKey: `word-${index + 1}`, answer: value }) }); }
  async function checkListening() { if (busy || !answer || feedback.startsWith("Верно")) return; setBusy(true); try { const result = await submitAttempt(answer); setFeedback(result.correct ? "Верно — вы узнали фразу на слух." : "Пока неверно. Выберите другой вариант и проверьте ещё раз."); } catch (error) { setFeedback((error as Error).message); } finally { setBusy(false); } }
  async function checkPronunciation(value: string) { if (busy || !value.trim()) return; setAnswer(value); setFeedback(""); setBusy(true); try { const result = await submitAttempt(value); setFeedback(`${result.feedback}. Результат: ${result.score}%. Это оценка совпадения распознанной фразы, не фонетики.`); } catch (error) { setFeedback((error as Error).message); } finally { setBusy(false); } }
  function advancePractice(nextStage: Stage) { const atEnd = index === words.length - 1; setFeedback(""); setAnswer(""); setIndex(atEnd ? 0 : index + 1); if (atEnd) setStage(nextStage); }
  async function checkQuiz(event: FormEvent) { event.preventDefault(); if (busy || feedback || !answer.trim()) return; setBusy(true); try { const result = await submitAttempt(answer); const total = quizPoints + result.score; setQuizPoints(total); setFeedback(`${result.feedback}. ${result.score} из 100.`); if (index === Math.min(words.length, 5) - 1) await saveProgress(total >= Math.min(words.length, 5) * 80 ? 100 : 90, total >= Math.min(words.length, 5) * 80, words.length); } catch (error) { setFeedback((error as Error).message); } finally { setBusy(false); } }
  const changeStage = (value: Stage) => { if (busy) return; tts.stop(); setQuizPoints(0); setStage(value); setIndex(0); setAnswer(""); setFeedback(""); };
  const nav = <div className="training-modes" aria-label="Этапы урока">{stageLabels.map(([value, label]) => <button key={value} className={stage === value ? "selected" : ""} aria-pressed={stage === value} disabled={busy} onClick={() => changeStage(value)}><b>{label}</b></button>)}</div>;
  if (stage === "cards") return <section className="page"><p className="eyebrow">УРОК {lesson.position} · {lesson.content.minutes} МИНУТ</p><h1>{lesson.title}</h1>{nav}<div className="lesson-layout"><article className="word-card"><div className="step"><span>Карточка {index + 1} из {words.length}</span><b>{Math.round(((index + 1) / words.length) * 100)}%</b></div><div className="bar"><i style={{ width: `${((index + 1) / words.length) * 100}%` }} /></div><p className="meta">{course.data.language_name}</p><h2 lang={course.data.language_key}>{word.target}</h2><button className="audio" onClick={() => void speak(word.target, targetLocale)}><Volume2 /> 1×</button><button className="audio" onClick={() => void speak(word.target, targetLocale, 0.72)}><Volume2 /> 0,75×</button><button className="reveal" onClick={() => setShow((value) => !value)}>{show ? "Скрыть перевод" : "Показать перевод"}</button>{show && <div className="translation"><b>{word.source}</b><p>{word.example}</p><small>{word.hint}</small><button className="button ghost" onClick={() => void speak(word.example, targetLocale, 0.82)}>Прослушать пример</button></div>}<div className="row wrap"><button className="button ghost" disabled={index === 0 || busy} onClick={() => { setIndex((value) => value - 1); setShow(false); }}><ChevronLeft /> Назад</button><button className="button ghost" disabled={busy} onClick={() => void addWord()}><Plus /> В словарь</button><button className="button secondary" disabled={busy} onClick={() => void nextCard()}>Знаю <Check /></button></div><p role="status">{feedback}</p></article><aside className="explain"><h3>Без сложных терминов</h3><p>{lesson.content.explanation}</p><h3>Дальше в уроке</h3><button onClick={() => changeStage("listening")}><Headphones /> Аудирование</button><button onClick={() => changeStage("pronunciation")}><Mic /> Произношение</button><button onClick={() => changeStage("quiz")}>Итоговая проверка <ArrowRight /></button></aside></div>{lesson.content.conversation?.length && <ConversationPractice key={lessonKey} prompts={lesson.content.conversation} locale={targetLocale} />}</section>;
  if (stage === "listening") { const alternatives = [...new Set([word.target, ...words.filter(item => item.target !== word.target).slice(0, 2).map(item => item.target)])].sort((a, b) => a.localeCompare(b)), correct = feedback.startsWith("Верно"); return <section className="page"><p className="eyebrow">АУДИРОВАНИЕ · УРОК {lesson.position}</p><h1>Слушаем: {lesson.title}</h1>{nav}<article className="practice"><button className="listen" onClick={() => void speak(word.target, targetLocale, 0.82)}><Volume2 /> Прослушать</button><fieldset disabled={busy || correct}><legend>Что вы услышали?</legend>{alternatives.map((value) => <label className="option" key={value}><input type="radio" name="listening" checked={answer === value} onChange={() => { setAnswer(value); setFeedback(""); }} />{value}</label>)}</fieldset><button className="button secondary" disabled={!answer || busy || correct} onClick={() => void checkListening()}>Проверить ответ</button><p className={correct ? "feedback success" : "feedback"} role="status">{feedback}</p>{correct && <button className="button primary" onClick={() => advancePractice("pronunciation")}>Дальше <ArrowRight /></button>}</article></section>; }
  if (stage === "pronunciation") return <section className="page"><p className="eyebrow">ПРОИЗНОШЕНИЕ · УРОК {lesson.position}</p><h1>Говорим: {lesson.title}</h1>{nav}<article className="practice"><p className="target" lang={course.data.language_key}>{word.target}</p><button className="audio" onClick={() => void speak(word.target, targetLocale, 0.8)}><Volume2 /> Послушать образец</button><label>Распознанная фраза<input value={answer} readOnly /></label><LessonVoiceInput key={index} locale={targetLocale} disabled={busy} onStart={() => { setFeedback(""); setAnswer(""); }} onTranscript={checkPronunciation} /><p className="feedback" role="status">{feedback}</p>{feedback.includes("Результат:") && !busy && <button className="button secondary" onClick={() => advancePractice("quiz")}>Следующая фраза</button>}</article></section>;
  const quizLength = Math.min(words.length, 5), lastQuestion = index === quizLength - 1;
  return <section className="page"><p className="eyebrow">ИТОГОВАЯ ПРОВЕРКА · УРОК {lesson.position}</p><h1>{lesson.title}</h1>{nav}<article className="quiz"><div className="step"><span>Вопрос {index + 1} из {quizLength}</span><b>{quizPoints} баллов</b></div><p className="target">{word.source}</p><form onSubmit={checkQuiz}><label>Переведите на {course.data.language_name.toLowerCase()}<input value={answer} onChange={(event) => setAnswer(event.target.value)} required /></label><button className="button primary" disabled={busy || Boolean(feedback)}>Проверить</button><LessonVoiceInput key={index} locale={targetLocale} disabled={busy || Boolean(feedback)} onTranscript={setAnswer} /></form><p className="feedback" role="status">{feedback}</p>{feedback && (!lastQuestion ? <button className="button secondary" onClick={() => { setIndex((value) => value + 1); setAnswer(""); setFeedback(""); }}>Следующий вопрос</button> : <div><h2>{quizPoints >= quizLength * 80 ? "\u041f\u0440\u043e\u0439\u0434\u0435\u043d\u043e" : "\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435"}</h2><button className="button secondary" onClick={() => changeStage("quiz")}>{"\u0415\u0449\u0451 \u0440\u0430\u0437"}</button><p>{quizPoints} из {quizLength * 100} баллов</p><Link className="button primary" to={`/programs/${courseKey}`}>К списку уроков</Link></div>)}</article></section>;
}

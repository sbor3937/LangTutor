import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Mic, Volume2 } from "lucide-react";
import { useInternetAccount } from "./InternetApp";
import { BrowserSpeechRecognitionProvider, tts } from "../lib/speech";

type Word = { target: string; source: string };
type Lesson = { lesson_key: string; title: string; content: { words: Word[] } };
type Course = { key: string; name: string; language_name: string; course_version_id: string; lessons: Lesson[] };
type Progress = { course_version_id: string; lesson_key: string; completion_percent: number; completed: boolean };
type TutorTurn = { role: "user" | "assistant"; text: string };
type TutorResponse = {
  replyItalian: string;
  replyRussian: string;
  corrected: string;
  explanationRu: string;
  nextQuestion: string;
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? "Не удалось выполнить запрос");
  return body as T;
}

function useVoiceInput(setValue: (value: string) => void) {
  const recognition = useMemo(() => new BrowserSpeechRecognitionProvider(), []);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  useEffect(() => () => recognition.dispose(), [recognition]);
  async function toggle() {
    if (listening) {
      const result = await recognition.stop();
      setListening(false);
      if (result.transcript) setValue(result.transcript);
      setVoiceStatus(result.transcript ? "Ответ распознан." : "Речь не распознана. Попробуйте ещё раз или введите текст.");
      return;
    }
    if (!recognition.isAvailable()) {
      setVoiceStatus("Голосовой ввод не поддерживается этим браузером. Используйте Chrome или Edge и разрешите микрофон.");
      return;
    }
    try {
      setVoiceStatus("Слушаю…");
      setListening(true);
      await recognition.start({
        onInterim: setValue,
        onFinal: setValue,
        onError: () => { setListening(false); setVoiceStatus("Не удалось распознать речь. Проверьте разрешение на микрофон."); },
        onEnd: (value) => { setListening(false); if (value) { setValue(value); setVoiceStatus("Ответ распознан."); } },
      });
    } catch {
      setListening(false);
      setVoiceStatus("Не удалось включить микрофон. Проверьте разрешение браузера.");
    }
  }
  return { listening, voiceStatus, toggle };
}

async function speak(text: string, lang = "it-IT") {
  await tts.speak(text, { lang, rate: 0.9 }).catch(() => undefined);
}

export function InternetTrainingPage() {
  const { activeCourse } = useInternetAccount();
  const [position, setPosition] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const voice = useVoiceInput(setAnswer);
  const course = useQuery({
    queryKey: ["internet-course", activeCourse?.course_key],
    queryFn: () => request<Course>(`/api/v1/learning/courses/${activeCourse!.course_key}`),
    enabled: Boolean(activeCourse),
  });
  const progress = useQuery({
    queryKey: ["internet-progress"],
    queryFn: () => request<{ lessons: Progress[] }>("/api/v1/learning/progress"),
    enabled: Boolean(activeCourse),
  });
  const exercises = useMemo(() => {
    if (!course.data) return [];
    const started = new Set((progress.data?.lessons ?? [])
      .filter((item) => item.course_version_id === course.data.course_version_id && (item.completed || item.completion_percent > 0))
      .map((item) => item.lesson_key));
    return course.data.lessons
      .filter((lesson) => started.has(lesson.lesson_key) && lesson.content.words[0])
      .map((lesson) => ({ lessonKey: lesson.lesson_key, lessonTitle: lesson.title, word: lesson.content.words[0] }));
  }, [course.data, progress.data?.lessons]);
  const current = exercises[position % Math.max(exercises.length, 1)];
  const attempt = useMutation({
    mutationFn: () => request<{ score: number; correct: boolean; feedback: string }>("/api/v1/learning/attempts", {
      method: "POST",
      body: JSON.stringify({ courseKey: activeCourse!.course_key, lessonKey: current.lessonKey, exerciseKey: "word-1", answer }),
    }),
    onSuccess: (result) => setFeedback(`${result.feedback}. Результат: ${result.score} из 100.`),
    onError: (error) => setFeedback((error as Error).message),
  });
  function submit(event: FormEvent) { event.preventDefault(); if (current && answer.trim()) attempt.mutate(); }
  if (!activeCourse) return <section className="page"><h1>Тренировка</h1><p>Сначала выберите учебную программу.</p><Link className="button primary" to="/programs">Выбрать программу</Link></section>;
  if (course.isLoading || progress.isLoading) return <section className="page"><h1>Тренировка</h1><p role="status">Готовим задания…</p></section>;
  if (!current) return <section className="page"><p className="eyebrow">{activeCourse.language_name}</p><h1>Тренировка</h1><p className="lead">Начните хотя бы один урок — после этого здесь появятся задания по пройденному материалу.</p><Link className="button primary" to={`/programs/${activeCourse.course_key}`}>Перейти к урокам</Link></section>;
  return <section className="page"><p className="eyebrow">{activeCourse.language_name} · ПРОЙДЕННЫЙ МАТЕРИАЛ</p><h1>Тренировка</h1><article className="card practice"><p>{current.lessonTitle}</p><h2>{current.word.source}</h2><form onSubmit={submit}><label>Ответ на изучаемом языке<input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} required maxLength={500} /></label><div className="row wrap"><button type="button" className={voice.listening ? "mic-button recording" : "mic-button"} onClick={() => void voice.toggle()}><Mic /> {voice.listening ? "Остановить" : "Ответить голосом"}</button><button className="button primary" disabled={attempt.isPending}>Проверить</button></div></form><p role="status" aria-live="polite">{voice.voiceStatus || feedback}</p>{feedback && <div className="row wrap"><button className="button ghost" onClick={() => void speak(current.word.target)}><Volume2 /> Прослушать ответ</button><button className="button secondary" onClick={() => { setPosition((value) => value + 1); setAnswer(""); setFeedback(""); }}>Следующее задание</button></div>}</article></section>;
}

export function InternetTutorPage() {
  const { activeCourse } = useInternetAccount();
  const [scenario, setScenario] = useState("intro");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<TutorTurn[]>([]);
  const [details, setDetails] = useState<TutorResponse | null>(null);
  const voice = useVoiceInput(setInput);
  const tutor = useMutation({
    mutationFn: (message: string) => request<TutorResponse>("/api/v1/tutor", { method: "POST", body: JSON.stringify({ message, scenario, history: history.slice(-12) }) }),
    onSuccess: (result, message) => {
      setHistory((items) => [...items, { role: "user", text: message }, { role: "assistant", text: result.replyItalian }]);
      setDetails(result);
      setInput("");
    },
  });
  function submit(event: FormEvent) { event.preventDefault(); const message = input.trim(); if (message) tutor.mutate(message); }
  if (!activeCourse) return <section className="page"><h1>Репетитор</h1><p>Сначала выберите учебную программу.</p><Link className="button primary" to="/programs">Выбрать программу</Link></section>;
  if (activeCourse.language_key !== "it") return <section className="page"><p className="eyebrow">{activeCourse.language_name}</p><h1>Репетитор</h1><p className="lead">AI-репетитор для этой программы готовится. Сейчас доступен репетитор итальянского языка.</p></section>;
  return <section className="page"><p className="eyebrow">{activeCourse.language_name} · A0–A1</p><h1>AI-репетитор</h1><label>Ситуация<select value={scenario} onChange={(event) => { setScenario(event.target.value); setHistory([]); setDetails(null); }}><option value="intro">Знакомство</option><option value="cafe">В кафе</option><option value="ticket">Билет и дорога</option><option value="hotel">В отеле</option><option value="shopping">В магазине</option></select></label><div className="chat" aria-live="polite">{history.map((turn, index) => <div className={`bubble ${turn.role}`} key={`${index}-${turn.role}`}>{turn.text}{turn.role === "assistant" && <button className="icon" aria-label="Прослушать реплику" onClick={() => void speak(turn.text)}><Volume2 /></button>}</div>)}</div>{details && <article className="card"><b>{details.replyItalian}</b><button className="icon" aria-label="Прослушать ответ репетитора" onClick={() => void speak(details.replyItalian)}><Volume2 /></button><p>{details.replyRussian}</p><p><strong>Исправление:</strong> {details.corrected}</p><p>{details.explanationRu}</p><p>{details.nextQuestion}</p></article>}<form className="composer" onSubmit={submit}><button type="button" className={voice.listening ? "mic-button recording" : "mic-button"} onClick={() => void voice.toggle()}><Mic /> {voice.listening ? "Остановить" : "Ответить голосом"}</button><label className="sr-only" htmlFor="internet-tutor-input">Ваш ответ</label><input id="internet-tutor-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Напишите фразу на итальянском" maxLength={800} required /><button className="button primary" disabled={tutor.isPending}>Отправить</button></form><p role="status" aria-live="polite">{voice.voiceStatus}</p>{tutor.error && <p role="alert">{(tutor.error as Error).message}</p>}<small>Доступен демонстрационный режим без внешнего AI. Использование моделей определяется настройками семьи.</small></section>;
}

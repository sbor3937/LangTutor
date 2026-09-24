import { useEffect, useRef, useState } from "react";
import type { ConversationPrompt } from "../../../content/types";
import { LessonVoiceInput } from "./LessonVoiceInput";
import { tts } from "../lib/speech";
import { TutorFeedback, tutorFeedbackSchema, type TutorFeedbackData } from "./TutorFeedback";

export function ConversationPractice({ prompts, locale, enableCheck = false }: { prompts: ConversationPrompt[]; locale: string; enableCheck?: boolean }) {
  const [index, setIndex] = useState(0), [answer, setAnswer] = useState(""), [show, setShow] = useState(false);
  const [result, setResult] = useState<TutorFeedbackData | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const revision = useRef(0);
  function updateAnswer(value: string) { revision.current++; setAnswer(value); setResult(null); setError(""); }
  useEffect(() => () => tts.stop(), []);
  const prompt = prompts[index % prompts.length];
  async function checkAnswer() {
    if (!answer.trim() || pending || !prompt) return;
    const submittedRevision = revision.current;
    setPending(true); setResult(null); setError("");
    try {
      const response = await fetch("/api/v1/tutor", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: locale.startsWith("en") ? "en" : "it", scenario: "intro", question: prompt.question, message: answer.trim(), history: [] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Не удалось проверить ответ. Попробуйте ещё раз.");
      const feedback = tutorFeedbackSchema.parse(body);
      if (revision.current === submittedRevision) setResult(feedback);
    } catch (err) { if (revision.current === submittedRevision) setError(err instanceof Error ? err.message : "Не удалось проверить ответ."); }
    finally { setPending(false); }
  }
  if (!prompt) return null;
  return <aside className="card conversation-practice">
    <p className="eyebrow">РАЗГОВОРНАЯ МИССИЯ · {index + 1} / {prompts.length}</p>
    <p>Прочитайте или прослушайте вопрос. Ответьте на изучаемом языке голосом или текстом. Если трудно начать, нажмите «Нужна подсказка».</p>
    <h2>{prompt.question}</h2>
    <button className="button ghost" onClick={() => void tts.speak(prompt.question, { lang: locale, rate: 0.85 }).catch(() => undefined)}>Прослушать вопрос</button>
    <p>{prompt.tip}</p>
    <label>Мой ответ<textarea value={answer} disabled={pending} maxLength={800} onChange={event => updateAnswer(event.target.value)} /></label>
    <LessonVoiceInput key={index} locale={locale} disabled={pending} onTranscript={updateAnswer} />
    {enableCheck && <button className="button primary" disabled={pending || !answer.trim()} onClick={() => void checkAnswer()}>{pending ? "Проверяем…" : "Проверить ответ"}</button>}
    {result && <TutorFeedback result={result} />}
    {error && <p role="alert">{error}</p>}
    <div className="row wrap"><button className="button secondary" onClick={() => setShow(!show)}>{show ? "Скрыть образец" : "Нужна подсказка"}</button>
    {prompts.length > 1 && <button disabled={pending} className="button secondary" onClick={() => { setIndex((index + 1) % prompts.length); updateAnswer(""); setShow(false); tts.stop(); }}>Другой вопрос</button>}</div>
    {show && <div className="translation"><p>{prompt.modelAnswer}</p><button className="button ghost" onClick={() => void tts.speak(prompt.modelAnswer, { lang: locale, rate: 0.85 }).catch(() => undefined)}>Прослушать образец</button></div>}
    <p><small>{enableCheck ? "Введите или произнесите ответ, затем нажмите «Проверить ответ». Обратная связь репетитора не изменяет баллы урока. Ответ не сохраняется как учебная попытка." : "Свободная практика с подсказками: ответ здесь не оценивается автоматически и не сохраняется. Обсудите его с репетитором. Для баллов пройдите этап «Проверка»."}</small></p>
  </aside>;
}

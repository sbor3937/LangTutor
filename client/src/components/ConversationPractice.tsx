import { useEffect, useState } from "react";
import type { ConversationPrompt } from "../../../content/types";
import { LessonVoiceInput } from "./LessonVoiceInput";
import { tts } from "../lib/speech";

export function ConversationPractice({ prompts, locale }: { prompts: ConversationPrompt[]; locale: string }) {
  const [index, setIndex] = useState(0), [answer, setAnswer] = useState(""), [show, setShow] = useState(false);
  useEffect(() => () => tts.stop(), []);
  const prompt = prompts[index % prompts.length];
  if (!prompt) return null;
  return <aside className="card conversation-practice">
    <p className="eyebrow">РАЗГОВОРНАЯ МИССИЯ · {index + 1} / {prompts.length}</p>
    <h2>{prompt.question}</h2>
    <button className="button ghost" onClick={() => void tts.speak(prompt.question, { lang: locale, rate: 0.85 }).catch(() => undefined)}>Прослушать вопрос</button>
    <p>{prompt.tip}</p>
    <label>Мой ответ<textarea value={answer} maxLength={1500} onChange={event => setAnswer(event.target.value)} /></label>
    <LessonVoiceInput key={index} locale={locale} disabled={false} onTranscript={setAnswer} />
    <div className="row wrap"><button className="button secondary" onClick={() => setShow(!show)}>{show ? "Скрыть образец" : "Нужна подсказка"}</button>
    {prompts.length > 1 && <button className="button secondary" onClick={() => { setIndex((index + 1) % prompts.length); setAnswer(""); setShow(false); tts.stop(); }}>Другой вопрос</button>}</div>
    {show && <div className="translation"><p>{prompt.modelAnswer}</p><button className="button ghost" onClick={() => void tts.speak(prompt.modelAnswer, { lang: locale, rate: 0.85 }).catch(() => undefined)}>Прослушать образец</button></div>}
    <p><small>Свободная практика с подсказками: ответ здесь не оценивается автоматически и не сохраняется. Обсудите его с репетитором. Для баллов пройдите этап «Проверка».</small></p>
  </aside>;
}

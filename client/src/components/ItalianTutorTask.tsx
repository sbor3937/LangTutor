import { tts } from "../lib/speech";

export const italianStarters: Record<string, { question: string; task: string }> = {
  intro: { question: "Ciao! Come ti chiami?", task: "Представьтесь: Mi chiamo… Можно использовать вымышленное имя." },
  cafe: { question: "Buongiorno! Cosa desidera?", task: "Закажите напиток: Vorrei un caffè, per favore." },
  ticket: { question: "Buongiorno! Come posso aiutarla?", task: "Попросите билет: Un biglietto, per favore." },
  hotel: { question: "Buongiorno! Ha una prenotazione?", task: "Сообщите о бронировании: Ho una prenotazione." },
  shopping: { question: "Buongiorno! Come posso aiutarla?", task: "Спросите цену вещи: Quanto costa?" },
};

export function ItalianTutorTask({ scenario, nextQuestion }: { scenario: string; nextQuestion?: string }) {
  const starter = italianStarters[scenario] ?? italianStarters.intro;
  // Older demo responses combine an Italian question with its Russian translation.
  // Never send Russian instructions to the Italian voice.
  const candidate = nextQuestion?.split(/\s+[—–]\s+/)[0].trim() ?? "";
  const question = nextQuestion === undefined ? starter.question : candidate && !/[а-яё]/i.test(candidate) ? candidate : "";
  const task = nextQuestion === undefined ? starter.task : /[а-яё]/i.test(nextQuestion) ? nextQuestion : "Ответьте на вопрос по-итальянски. Можно написать ответ или воспользоваться микрофоном.";
  return <article className="card" aria-label="Текущее задание">
    <h2>{question ? "Вопрос для вас" : "Ваше задание"}</h2>
    {question && <><p lang="it">{question}</p><button type="button" className="button ghost" onClick={() => void tts.speak(question, { lang: "it-IT", rate: 0.9 }).catch(() => undefined)}>Прослушать вопрос</button></>}
    <p><strong>Что нужно сделать:</strong> {task}</p>
  </article>;
}

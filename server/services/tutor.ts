import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import { ZodError } from "zod";
import { config } from "../config.js";
import { tutorResponseSchema, type TutorResponse } from "../../shared/schemas.js";

type HistoryItem = { role: "user" | "assistant"; text: string };
type Turn = { replyItalian: string; replyRussian: string; nextQuestion: string };
type ScenarioPlan = { lessonId: string; goal: string; keyPhrases: string[]; turns: Turn[] };

const plans: Record<string, ScenarioPlan> = {
  intro: { lessonId: "greetings", goal: "поздороваться, представиться и попрощаться", keyPhrases: ["Ciao", "Mi chiamo…", "Piacere", "Arrivederci"], turns: [
    { replyItalian: "Ciao! Piacere di conoscerti.", replyRussian: "Привет! Приятно познакомиться.", nextQuestion: "Come ti chiami? — Как вас зовут?" },
    { replyItalian: "Piacere! Io sono Luca.", replyRussian: "Очень приятно! Я Лука.", nextQuestion: "Come stai oggi? — Как вы сегодня?" },
    { replyItalian: "Bene, grazie!", replyRussian: "Хорошо, спасибо!", nextQuestion: "Теперь попрощайтесь по-итальянски." },
  ]},
  cafe: { lessonId: "cafe", goal: "заказать напиток или еду и попросить счет", keyPhrases: ["Vorrei…", "per favore", "Quanto costa?", "il conto"], turns: [
    { replyItalian: "Buongiorno! Cosa desidera?", replyRussian: "Добрый день! Что желаете?", nextQuestion: "Закажите напиток с Vorrei…, per favore." },
    { replyItalian: "Certamente. Desidera anche qualcosa da mangiare?", replyRussian: "Конечно. Хотите также что-нибудь поесть?", nextQuestion: "Закажите еду или ответьте No, grazie." },
    { replyItalian: "Va bene. Sono otto euro.", replyRussian: "Хорошо. Восемь евро.", nextQuestion: "Спросите цену или попросите счет." },
  ]},
  ticket: { lessonId: "city", goal: "купить билет и уточнить путь", keyPhrases: ["un biglietto", "la stazione", "a destra", "a sinistra"], turns: [
    { replyItalian: "Buongiorno. Dove vuole andare?", replyRussian: "Добрый день. Куда вы хотите поехать?", nextQuestion: "Попросите один билет, пожалуйста." },
    { replyItalian: "Ecco il biglietto.", replyRussian: "Вот билет.", nextQuestion: "Спросите, где станция." },
    { replyItalian: "La stazione è a destra, molto vicino.", replyRussian: "Станция направо, совсем близко.", nextQuestion: "Подтвердите, что поняли, и поблагодарите." },
  ]},
  hotel: { lessonId: "hotel", goal: "сообщить о бронировании и получить номер", keyPhrases: ["Ho una prenotazione", "una camera", "per una notte", "il documento", "la chiave"], turns: [
    { replyItalian: "Buonasera. Ha una prenotazione?", replyRussian: "Добрый вечер. У вас есть бронь?", nextQuestion: "Ответьте: Ho una prenotazione." },
    { replyItalian: "A che nome è la prenotazione?", replyRussian: "На какое имя бронь?", nextQuestion: "Назовите себя с Mi chiamo…" },
    { replyItalian: "Perfetto. La camera è la numero dodici. Ecco la chiave.", replyRussian: "Отлично. Ваш номер — двенадцать. Вот ключ.", nextQuestion: "Спросите, где находится номер." },
  ]},
  time: { lessonId: "time", goal: "спросить время и договориться о встрече", keyPhrases: ["Che ore sono?", "A che ora?", "alle tre", "oggi", "domani"], turns: [
    { replyItalian: "Ci vediamo oggi?", replyRussian: "Увидимся сегодня?", nextQuestion: "Спросите: A che ora?" },
    { replyItalian: "Alle tre del pomeriggio.", replyRussian: "В три часа дня.", nextQuestion: "Подтвердите встречу в три часа." },
    { replyItalian: "Perfetto. Davanti alla stazione.", replyRussian: "Отлично. Перед станцией.", nextQuestion: "Переспросите, где встреча." },
  ]},
  food: { lessonId: "food", goal: "сказать о предпочтениях и заказать еду", keyPhrases: ["Ho fame", "Mi piace…", "Non mi piace…", "senza formaggio"], turns: [
    { replyItalian: "Ha fame? Che cosa le piace?", replyRussian: "Вы голодны? Что вам нравится?", nextQuestion: "Ответьте с Ho fame и Mi piace…" },
    { replyItalian: "Ottima scelta! Con formaggio?", replyRussian: "Отличный выбор! С сыром?", nextQuestion: "Ответьте: con formaggio или senza formaggio." },
    { replyItalian: "E da bere?", replyRussian: "А что будете пить?", nextQuestion: "Закажите воду или сок." },
  ]},
  shopping: { lessonId: "shopping", goal: "выбрать товар, узнать цену и оплатить", keyPhrases: ["Vorrei questo", "Quanto costa?", "troppo caro", "con la carta"], turns: [
    { replyItalian: "Buongiorno. Posso aiutarla?", replyRussian: "Добрый день. Могу вам помочь?", nextQuestion: "Выберите товар: Vorrei questo…" },
    { replyItalian: "Certo. Lo preferisce rosso o blu?", replyRussian: "Конечно. Предпочитаете красный или синий?", nextQuestion: "Назовите цвет и спросите цену." },
    { replyItalian: "Costa venti euro.", replyRussian: "Стоит двадцать евро.", nextQuestion: "Согласитесь или скажите, что дорого, затем спросите об оплате картой." },
  ]},
  directions: { lessonId: "city", goal: "спросить дорогу и понять направление", keyPhrases: ["Dov'è…?", "a destra", "a sinistra", "vicino", "lontano"], turns: [
    { replyItalian: "Buongiorno. Dove deve andare?", replyRussian: "Добрый день. Куда вам нужно?", nextQuestion: "Спросите, где станция или кафе." },
    { replyItalian: "È vicino: prima a destra, poi a sinistra.", replyRussian: "Это близко: сначала направо, затем налево.", nextQuestion: "Повторите маршрут, чтобы проверить понимание." },
    { replyItalian: "Esatto! È a cinque minuti.", replyRussian: "Верно! Это в пяти минутах.", nextQuestion: "Поблагодарите и попрощайтесь." },
  ]},
  help: { lessonId: "help", goal: "объяснить проблему и попросить говорить медленнее", keyPhrases: ["Mi scusi", "Ho bisogno di aiuto", "Non capisco", "Può ripetere?", "Ho perso…"], turns: [
    { replyItalian: "Certo, mi dica. Che cosa è successo?", replyRussian: "Конечно, расскажите. Что случилось?", nextQuestion: "Скажите, что потеряли билет или телефон." },
    { replyItalian: "Capisco. Dove lo ha visto l'ultima volta?", replyRussian: "Понимаю. Где вы видели это в последний раз?", nextQuestion: "Если трудно, попросите повторить медленнее." },
    { replyItalian: "Va bene, parlo più lentamente. Andiamo alla stazione.", replyRussian: "Хорошо, говорю медленнее. Пойдем к станции.", nextQuestion: "Поблагодарите за помощь." },
  ]},
};

const openRouterAgent = config.proxyUrl ? new ProxyAgent(config.proxyUrl) : undefined;
const openRouterFetch = (url: string | URL | Request, init?: RequestInit) =>
  undiciFetch(url as any, { ...(init as any), dispatcher: openRouterAgent }) as any;

const normalize = (value: string) => value.toLocaleLowerCase("it").replace(/[.!?…,'’]/g, " ").replace(/\s+/g, " ").trim();

function correctionFor(message: string, scenario: string) {
  const text = message.trim();
  const low = normalize(text);
  if (/^sono\s+/i.test(text) && scenario === "intro") return { corrected: text.replace(/^sono/i, "Mi chiamo").replace(/\.?$/, "."), explanation: "Для представления по имени естественнее использовать Mi chiamo…" };
  if (low === "non so" || low === "не знаю" || low.length < 2) return { corrected: plans[scenario].keyPhrases[0], explanation: `Попробуйте опереться на модель «${plans[scenario].keyPhrases[0]}».` };
  const corrected = text.charAt(0).toLocaleUpperCase("it") + text.slice(1).replace(/\s+/g, " ").replace(/\.?$/, ".");
  return { corrected, explanation: corrected === text ? "Фраза подходит для этого шага." : "Исправлены оформление и пунктуация; смысл сохранён." };
}

export function demoTutor(message: string, scenario = "intro", history: HistoryItem[] = []): TutorResponse {
  const plan = plans[scenario] || plans.intro;
  const userTurns = history.filter((item) => item.role === "user").length;
  const turn = plan.turns[userTurns % plan.turns.length];
  const { corrected, explanation } = correctionFor(message, scenario);
  return { replyItalian: turn.replyItalian, replyRussian: turn.replyRussian, original: message.trim(), corrected, explanationRu: explanation, naturalVariant: corrected === message.trim() ? null : corrected, nextQuestion: turn.nextQuestion, scenario, level: "A0" };
}

export async function liveTutor(message: string, scenario: string, history: HistoryItem[], unlockedLessonIds: string[] = []) {
  const plan = plans[scenario] || plans.intro;
  if (!config.liveAI || !config.openrouterKey) return { data: demoTutor(message, scenario, history), mode: "demo" as const };
  const materialState = unlockedLessonIds.includes(plan.lessonId) ? `Материал сценария открыт. Разрешенные опоры: ${plan.keyPhrases.join(", ")}.` : "Материал сценария еще не проходили. Используй только короткие подсказки A0 и объясняй новое по-русски.";
  try {
    const client = new OpenAI({ apiKey: config.openrouterKey, baseURL: config.openrouterBase, timeout: 20000, fetch: openRouterFetch as any, defaultHeaders: { "HTTP-Referer": config.appUrl, "X-Title": "ItalianLearent" } });
    const completion = await client.chat.completions.create({ model: config.openrouterModel, temperature: .65, response_format: { type: "json_object" }, messages: [
      { role: "system", content: `Ты терпеливый разговорный репетитор итальянского A0 для русскоязычного ученика. Сценарий: ${scenario}. Цель: ${plan.goal}. ${materialState} Веди ролевой диалог вперед: учитывай историю, каждый ход меняй ситуацию или задавай новый уместный вопрос, не возвращай все ответы к знакомству. Исправляй только реальную ошибку. Реплика на итальянском — 1-2 коротких предложения, русский перевод точный. nextQuestion дает конкретное следующее действие ученику. Верни только JSON: replyItalian, replyRussian, original, corrected, explanationRu, naturalVariant, nextQuestion, scenario, level.` },
      ...history.slice(-10).map((item) => ({ role: item.role, content: item.text } as const)),
      { role: "user", content: message },
    ], max_tokens: 500 });
    const parsed = tutorResponseSchema.parse(JSON.parse(completion.choices[0]?.message.content || "{}"));
    return { data: parsed, mode: "live" as const };
  } catch (error) {
    const detail = error instanceof ZodError ? `schema:${error.issues.map((issue) => issue.path.join(".")).join(",")}` : error instanceof SyntaxError ? "invalid-json" : error instanceof OpenAI.APIError ? `upstream:${error.status || "unknown"}` : error instanceof Error ? error.name : "unknown";
    console.warn(`Live AI fallback (${detail})`);
    return { data: demoTutor(message, scenario, history), mode: "fallback" as const };
  }
}

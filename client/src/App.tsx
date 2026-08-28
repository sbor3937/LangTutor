import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import { AuthPage } from "./components/AuthPage";
import { ControlPage } from "./components/ControlPage";
import { FamilyAdmin, JoinFamily } from "./components/FamilyAdmin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Headphones,
  Mic,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Volume2,
} from "lucide-react";
import { Layout } from "./components/Layout";
import { lessons, scenarios } from "../../shared/content";
import { analyzePronunciation, onboardingPlan } from "../../shared/learning";
import { anonymousId, api, createAnonymousId, flushQueue } from "./lib/api";
import {
  activateProfile,
  isProfileOnboarded,
  migrateLegacyProfile,
  readProfiles,
  removeProfile as removeLocalProfile,
  upsertProfile,
  type LocalProfile,
} from "./lib/profiles";
import {
  BrowserSpeechRecognitionProvider,
  CloudSpeechRecognitionProvider,
  tts,
} from "./lib/speech";
const aid = anonymousId();
migrateLegacyProfile(aid);
const examPassScore = 80;
const hasPassedSecondBlockExam = (progress: any) =>
  Boolean(progress?.attempts?.some((attempt: any) => attempt.exerciseId === "mini-exam-blocks-1-2" && attempt.score >= examPassScore));
const createSpeechRecognition = () => {
  const cloud = new CloudSpeechRecognitionProvider();
  return cloud.isAvailable() ? cloud : new BrowserSpeechRecognitionProvider();
};
const italianName = (name?: string) => {
  const source = name?.trim();
  if (!source) return "Anna";
  const letters: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ы: "y",
    э: "e",
    ю: "yu",
    я: "ya",
    ь: "",
    ъ: "",
  };
  const value = [...source.toLowerCase()]
    .map((letter) => letters[letter] ?? letter)
    .join("")
    .replace(/iya$/u, "ia");
  return value.charAt(0).toUpperCase() + value.slice(1);
};
type TrainingMode = "words" | "phrases" | "sentences";
const connectedTraining: Record<
  string,
  Record<Exclude<TrainingMode, "words">, { it: string; ru: string }[]>
> = {
  greetings: {
    phrases: [
      { it: "Mi chiamo {name}", ru: "Меня зовут {name}" },
      { it: "Come ti chiami?", ru: "Как тебя зовут?" },
      { it: "Buongiorno, signora", ru: "Добрый день, синьора" },
    ],
    sentences: [
      { it: "Ciao, mi chiamo {name}.", ru: "Привет, меня зовут {name}." },
      { it: "Buongiorno! Piacere!", ru: "Добрый день! Приятно познакомиться!" },
      { it: "Grazie. Arrivederci!", ru: "Спасибо. До свидания!" },
    ],
  },
  reading: {
    phrases: [
      { it: "casa e famiglia", ru: "дом и семья" },
      { it: "cena e gelato", ru: "ужин и мороженое" },
      { it: "chi e che", ru: "кто и что" },
    ],
    sentences: [
      { it: "La famiglia è a casa.", ru: "Семья дома." },
      { it: "La parola è gelato.", ru: "Это слово — gelato." },
      { it: "Ciao, famiglia!", ru: "Привет, семья!" },
    ],
  },
  numbers: {
    phrases: [
      { it: "uno, due, tre", ru: "один, два, три" },
      { it: "dieci e venti", ru: "десять и двадцать" },
      { it: "quattro libri", ru: "четыре книги" },
    ],
    sentences: [
      { it: "Ho due libri.", ru: "У меня две книги." },
      { it: "Ho tre libri.", ru: "У меня три книги." },
      { it: "Uno, due, tre. Via!", ru: "Один, два, три. Вперёд!" },
    ],
  },
  cafe: {
    phrases: [
      { it: "un caffè", ru: "один кофе" },
      { it: "un'acqua, per favore", ru: "воду, пожалуйста" },
      { it: "il conto", ru: "счёт" },
    ],
    sentences: [
      {
        it: "Vorrei un caffè, per favore.",
        ru: "Я хотел(а) бы кофе, пожалуйста.",
      },
      { it: "Quanto costa?", ru: "Сколько стоит?" },
      { it: "Vorrei il conto. Grazie.", ru: "Я хотел(а) бы счёт. Спасибо." },
    ],
  },
  city: {
    phrases: [
      { it: "la stazione", ru: "станция" },
      { it: "il biglietto", ru: "билет" },
      { it: "a sinistra", ru: "налево" },
    ],
    sentences: [
      { it: "Dov'è la stazione?", ru: "Где станция?" },
      { it: "Un biglietto, per favore.", ru: "Один билет, пожалуйста." },
      { it: "L'autobus è vicino.", ru: "Автобус близко." },
    ],
  },
  hotel: {
    phrases: [
      { it: "una prenotazione", ru: "одна бронь" },
      { it: "per una notte", ru: "на одну ночь" },
      { it: "la camera numero dodici", ru: "номер комнаты двенадцать" },
    ],
    sentences: [
      { it: "Buongiorno, ho una prenotazione.", ru: "Добрый день, у меня есть бронь." },
      { it: "Una camera per una notte, per favore.", ru: "Номер на одну ночь, пожалуйста." },
      { it: "Dov'è la camera numero dodici?", ru: "Где находится номер двенадцать?" },
    ],
  },
  time: {
    phrases: [
      { it: "alle tre", ru: "в три часа" },
      { it: "oggi la sera", ru: "сегодня вечером" },
      { it: "domani la mattina", ru: "завтра утром" },
    ],
    sentences: [
      { it: "Che ore sono?", ru: "Который час?" },
      { it: "Ci vediamo alle tre.", ru: "Увидимся в три часа." },
      { it: "A che ora parte l'autobus?", ru: "Во сколько отправляется автобус?" },
    ],
  },
  food: {
    phrases: [
      { it: "senza formaggio", ru: "без сыра" },
      { it: "mi piace la pizza", ru: "мне нравится пицца" },
      { it: "ho fame", ru: "я голоден / голодна" },
    ],
    sentences: [
      { it: "Vorrei una pizza senza formaggio.", ru: "Я хотел(а) бы пиццу без сыра." },
      { it: "Mi piace la pasta.", ru: "Мне нравится паста." },
      { it: "Ho sete. Vorrei un'acqua.", ru: "Я хочу пить. Я хотел(а) бы воду." },
    ],
  },
  shopping: {
    phrases: [
      { it: "questo rosso", ru: "это красное" },
      { it: "troppo caro", ru: "слишком дорого" },
      { it: "con la carta", ru: "картой" },
    ],
    sentences: [
      { it: "Vorrei questo rosso.", ru: "Я хотел(а) бы это красное." },
      { it: "Quanto costa questo?", ru: "Сколько это стоит?" },
      { it: "Posso pagare con la carta?", ru: "Можно оплатить картой?" },
    ],
  },
  help: {
    phrases: [
      { it: "bisogno di aiuto", ru: "нужна помощь" },
      { it: "più lentamente", ru: "медленнее" },
      { it: "ho perso il biglietto", ru: "я потерял(а) билет" },
    ],
    sentences: [
      { it: "Mi scusi, ho bisogno di aiuto.", ru: "Извините, мне нужна помощь." },
      { it: "Può ripetere, per favore?", ru: "Повторите, пожалуйста." },
      { it: "Ho perso il biglietto. Dov'è la stazione?", ru: "Я потерял(а) билет. Где станция?" },
    ],
  },
  home: {
    phrases: [{ it: "la mia famiglia", ru: "моя семья" }, { it: "mio padre e mia madre", ru: "мой отец и моя мама" }, { it: "due camere", ru: "две комнаты" }],
    sentences: [{ it: "Questa è la mia famiglia.", ru: "Это моя семья." }, { it: "Abito a Roma.", ru: "Я живу в Риме." }, { it: "C'è una cucina e ci sono due camere.", ru: "Есть кухня и две комнаты." }],
  },
  routine: {
    phrases: [{ it: "alle sette", ru: "в семь часов" }, { it: "al lavoro", ru: "на работу" }, { it: "a casa", ru: "дома" }],
    sentences: [{ it: "Mi sveglio alle sette.", ru: "Я просыпаюсь в семь." }, { it: "Faccio colazione e vado al lavoro.", ru: "Я завтракаю и иду на работу." }, { it: "Torno alle sei e studio italiano.", ru: "Я возвращаюсь в шесть и учу итальянский." }],
  },
  weather: {
    phrases: [{ it: "fa freddo", ru: "холодно" }, { it: "c'è il sole", ru: "солнечно" }, { it: "la giacca e l'ombrello", ru: "куртка и зонт" }],
    sentences: [{ it: "Che tempo fa oggi?", ru: "Какая сегодня погода?" }, { it: "Piove e fa freddo.", ru: "Идёт дождь и холодно." }, { it: "Metto la giacca e prendo l'ombrello.", ru: "Я надеваю куртку и беру зонт." }],
  },
  health: {
    phrases: [{ it: "mal di testa", ru: "головная боль" }, { it: "mal di gola", ru: "боль в горле" }, { it: "un farmacista", ru: "фармацевт" }],
    sentences: [{ it: "Non sto bene. Ho mal di testa.", ru: "Я плохо себя чувствую. У меня болит голова." }, { it: "Mi serve un farmacista.", ru: "Мне нужен фармацевт." }, { it: "Devo vedere un medico.", ru: "Мне нужно обратиться к врачу." }],
  },
  plans: {
    phrases: [{ it: "domani sera", ru: "завтра вечером" }, { it: "al cinema", ru: "в кино" }, { it: "alle otto", ru: "в восемь" }],
    sentences: [{ it: "Vuoi andare al cinema domani?", ru: "Хочешь завтра пойти в кино?" }, { it: "Volentieri! A che ora ci vediamo?", ru: "С удовольствием! Во сколько встречаемся?" }, { it: "Mi dispiace, non posso. A domani!", ru: "Извини, я не могу. До завтра!" }],
  },
};
const speak = (text: string, rate = 1) =>
  tts
    .speak(text, { rate })
    .catch(() =>
      alert("Голос временно недоступен. Можно продолжить без аудио"),
    );
function Page({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: any;
}) {
  return (
    <section className="page">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children}
    </section>
  );
}
function LessonAccess({ children }: { children: ReactNode }) {
  const { lessonId } = useParams();
  const lesson = lessons.find((item) => item.id === lessonId);
  const { data, isLoading } = useQuery({ queryKey: ["progress"], queryFn: () => api<any>(`/api/progress/${aid}`), enabled: Boolean(lesson && lesson.number >= 11) });
  if (!lesson || lesson.number < 11) return children;
  if (isLoading) return <Page title="Проверяем доступ"><p>Загружаем результат мини-экзамена…</p></Page>;
  if (!hasPassedSecondBlockExam(data)) return <Page eyebrow="ТРЕТИЙ БЛОК • ПОКА ЗАКРЫТ" title="Сначала сдайте мини-экзамен"><p className="lead">Для уроков 11–15 нужен сохранённый результат не ниже {examPassScore}%.</p><Link className="button primary" to="/exam">Перейти к мини-экзамену <ArrowRight /></Link></Page>;
  return children;
}
function Home() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<any>(`/api/profile/${aid}`),
  });
  const { data: progress } = useQuery({
    queryKey: ["progress"],
    queryFn: () => api<any>(`/api/progress/${aid}`),
  });
  const done = progress?.lessons?.filter((x: any) => x.completed).length || 0;
  return (
    <Page
      eyebrow="BUONGIORNO"
      title={`Добрый день${profile?.name ? `, ${profile.name}` : ""}!`}
    >
      <div className="hero">
        <div>
          <span className="pill">Локальный режим</span>
          <h2>
            Сегодня — хороший день
            <br />
            для итальянского
          </h2>
          <p>15 минут: новые слова, аудирование и одна короткая фраза.</p>
          <Link className="button primary" to="/lessons/greetings">
            Продолжить урок <ArrowRight />
          </Link>
        </div>
        <div className="sun" aria-hidden="true">
          ciao!
        </div>
      </div>
      <div className="stats">
        <article>
          <b>🔥 3</b>
          <span>дня подряд</span>
        </article>
        <article>
          <b>{done}/5</b>
          <span>уроков завершено</span>
        </article>
        <article>
          <b>{progress?.attempts?.length || 0}</b>
          <span>тренировок</span>
        </article>
      </div>
      <h2>Быстрая практика</h2>
      <div className="grid three">
        <Link className="card action" to="/lessons/greetings/listening">
          <Headphones />
          <h3>Аудирование</h3>
          <p>Услышать живую речь</p>
        </Link>
        <Link className="card action" to="/lessons/greetings/pronunciation">
          <Mic />
          <h3>Произношение</h3>
          <p>Повторить одну фразу</p>
        </Link>
        <Link className="card action" to="/tutor">
          <MessageIcon />
          <h3>AI-репетитор</h3>
          <p>Провести короткий диалог</p>
        </Link>
      </div>
      <Link className="card action vocabulary-entry" to="/training">
        <span className="big-icon" aria-hidden="true">
          🎯
        </span>
        <div>
          <h3>Тренировка пройденных слов</h3>
          <p>Случайные слова, голосовой или текстовый ответ и оценка из 100</p>
        </div>
        <ArrowRight />
      </Link>
      <div className="notice">
        <b>Ваши данные остаются здесь</b>
        <span>
          Уроки и прогресс хранятся локально. Демо AI работает без внешних
          сервисов.
        </span>
      </div>
    </Page>
  );
}
function MessageIcon() {
  return <span className="big-icon">💬</span>;
}
function Onboarding() {
  const nav = useNavigate(),
    [step, setStep] = useState(1),
    [form, setForm] = useState({
      learningGoal: "travel",
      dailyMinutes: 15,
      initialLevel: "zero",
      name: "",
    }),
    [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const plan = onboardingPlan(form.dailyMinutes as any, form.learningGoal);
  const save = async () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    try {
      await api(`/api/profile/${aid}`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          anonymousId: aid,
          weeklyGoal: plan.weeklyGoal,
        }),
      });
      upsertProfile(aid, {
        name: form.name.trim() || "Ученик",
        onboarded: true,
      });
      nav("/lessons/greetings", { replace: true });
    } catch {
      setSaveState("error");
    }
  };
  const choices =
    step === 1
      ? [
          ["travel", "Путешествия"],
          ["communication", "Общение"],
          ["relocation", "Переезд"],
          ["work", "Работа"],
          ["self", "Для себя"],
        ]
      : step === 2
        ? [
            [10, "10 минут"],
            [15, "15 минут"],
            [20, "20 минут"],
            [30, "30 минут"],
          ]
        : [
            ["zero", "Совсем с нуля"],
            ["words", "Знаю отдельные слова"],
            ["previous", "Немного учил раньше"],
          ];
  const field =
    step === 1 ? "learningGoal" : step === 2 ? "dailyMinutes" : "initialLevel";
  return (
    <main className="onboarding">
      <div className="onboard-card">
        <p className="eyebrow">ШАГ {step} ИЗ 4</p>
        <div className="bar">
          <i style={{ width: `${step * 25}%` }} />
        </div>
        <h1>
          {
            [
              "",
              "Для чего вам итальянский?",
              "Сколько времени в день?",
              "С чего начинаем?",
              "Ваш персональный план",
            ][step]
          }
        </h1>
        {step < 4 ? (
          <div className="choice-list">
            {choices.map(([value, label]) => (
              <button
                className={(form as any)[field] === value ? "selected" : ""}
                onClick={() => setForm({ ...form, [field]: value })}
                key={value}
              >
                {label}
                <Check />
              </button>
            ))}
          </div>
        ) : (
          <div className="plan">
            <b>{plan.minutes} минут в день</b>
            <p>{plan.detail}</p>
            <p>
              {plan.newWords} новых слов • цель {plan.weeklyGoal} дней в неделю
            </p>
            <label>
              Как к вам обращаться?{" "}
              <input
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
          </div>
        )}
        <div className="row">
          <button
            className="button ghost"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
          >
            <ChevronLeft /> Назад
          </button>
          {step < 4 ? (
            <button
              className="button primary"
              onClick={() => setStep(step + 1)}
            >
              Далее <ArrowRight />
            </button>
          ) : (
            <button
              className="button primary"
              onClick={save}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Сохраняем…" : "Начать обучение"}{" "}
              <ArrowRight />
            </button>
          )}
        </div>
        {saveState === "error" && (
          <div className="feedback" role="alert">
            Не удалось сохранить план. Проверьте соединение и попробуйте ещё
            раз.
          </div>
        )}
        <button
          className="link-button"
          onClick={save}
          disabled={saveState === "saving"}
        >
          {saveState === "saving"
            ? "Сохраняем настройки…"
            : "Пропустить с рекомендуемыми настройками"}
        </button>
        <Link className="link-button" to="/profiles">
          Восстановить профили по семейному коду
        </Link>
      </div>
    </main>
  );
}
function Lessons() {
  const { data } = useQuery({
    queryKey: ["progress"],
    queryFn: () => api<any>(`/api/progress/${aid}`),
  });
  const thirdBlockUnlocked = hasPassedSecondBlockExam(data);
  return (
    <Page eyebrow="ПРОГРАММА A0–A1" title="Уроки">
      <p className="lead">
        Три блока по пять уроков: третий блок «Жизнь в Италии» открывается после
        мини-экзамена по урокам 1–10.
      </p>
      <div className="lesson-list">
        {lessons.map((l) => {
          const p = data?.lessons?.find((x: any) => x.lessonId === l.id);
          const locked = l.number >= 11 && !thirdBlockUnlocked;
          return (
            <article className="lesson-card" key={l.id}>
              <span className="lesson-number">{l.number}</span>
              <div>
                <p className="meta">
                  {l.minutes} МИН • {l.words.length} СЛОВ
                </p>
                <h2>{l.title}</h2>
                <p>{l.goal}</p>
                <div className="tags">
                  {l.practices.map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                </div>
                <div className="progress-line">
                  <i style={{ width: `${p?.completionPercent || 0}%` }} />
                </div>
              </div>
              {locked ? <span className="button ghost" aria-disabled="true">🔒 Экзамен ≥80%</span> : <Link className="button secondary" to={`/lessons/${l.id}`}>
                {p?.completed ? "Повторить" : p ? "Продолжить" : "Начать"} <ArrowRight />
              </Link>}
            </article>
          );
        })}
      </div>
      <Link className="button primary" to="/exam">
        Мини-экзамен по урокам 1–10 <ArrowRight />
      </Link>
    </Page>
  );
}
function Lesson() {
  const { lessonId } = useParams(),
    lesson = lessons.find((l) => l.id === lessonId) || lessons[0],
    [index, setIndex] = useState(0),
    [show, setShow] = useState(false),
    [actionStatus, setActionStatus] = useState(""),
    [busyAction, setBusyAction] = useState<"add" | "review" | "known" | "">(""),
    [progressLoaded, setProgressLoaded] = useState(false),
    qc = useQueryClient();
  const { data: progressData } = useQuery({
    queryKey: ["progress"],
    queryFn: () => api<any>(`/api/progress/${aid}`),
  });
  const word = lesson.words[index];
  useEffect(() => {
    setProgressLoaded(false);
    setIndex(0);
    setShow(false);
  }, [lesson.id]);
  useEffect(() => {
    if (progressLoaded || !progressData) return;
    const saved = progressData.lessons?.find(
      (item: any) => item.lessonId === lesson.id,
    );
    if (saved)
      setIndex(
        Math.min(Math.max(saved.currentStep || 0, 0), lesson.words.length - 1),
      );
    setProgressLoaded(true);
  }, [lesson.id, lesson.words.length, progressData, progressLoaded]);
  const progress = async (percent: number, completed = false, step = index) => {
    await api("/api/lesson-progress", {
      method: "POST",
      body: JSON.stringify({
        anonymousId: aid,
        lessonId: lesson.id,
        currentStep: step,
        completionPercent: percent,
        completed,
        score: completed ? 80 : undefined,
      }),
    });
    await qc.invalidateQueries({ queryKey: ["progress"] });
  };
  const advance = async () => {
    const nextIndex = Math.min(index + 1, lesson.words.length - 1);
    const percent = Math.round(((nextIndex + 1) / lesson.words.length) * 60);
    await progress(percent, false, nextIndex);
    setIndex(nextIndex);
    setShow(false);
  };
  const goBack = async () => {
    if (index === 0 || busyAction) return;
    const previousIndex = index - 1;
    const saved = progressData?.lessons?.find(
      (item: any) => item.lessonId === lesson.id,
    );
    const percent = Math.max(
      saved?.completionPercent || 0,
      Math.round(((previousIndex + 1) / lesson.words.length) * 60),
    );
    await progress(percent, false, previousIndex);
    setIndex(previousIndex);
    setShow(false);
    setActionStatus(`Возвращаемся к слову «${lesson.words[previousIndex].it}»`);
  };
  const saveWord = () =>
    api<{ ok: boolean }>("/api/words", {
      method: "POST",
      body: JSON.stringify({
        anonymousId: aid,
        italian: word.it,
        translation: word.ru,
        exampleItalian: word.example,
        lessonId: lesson.id,
      }),
    });
  const add = async () => {
    setBusyAction("add");
    setActionStatus("");
    try {
      await saveWord();
      await qc.invalidateQueries({ queryKey: ["words"] });
      await advance();
      setActionStatus(`«${word.it}» добавлено в «Мои слова»`);
    } catch {
      setActionStatus("Не удалось добавить слово. Попробуйте ещё раз");
    } finally {
      setBusyAction("");
    }
  };
  const markForReview = async () => {
    setBusyAction("review");
    setActionStatus("");
    try {
      await saveWord();
      const words = await api<any[]>(`/api/words/${aid}`);
      const saved = words.find(
        (item) =>
          item.italian.toLocaleLowerCase("it") ===
          word.it.toLocaleLowerCase("it"),
      );
      if (saved) {
        await api(`/api/words/${saved.id}/review`, {
          method: "POST",
          body: JSON.stringify({ action: "review" }),
        });
      }
      await qc.invalidateQueries({ queryKey: ["words"] });
      await advance();
      setActionStatus(`«${word.it}» отмечено для повторения`);
    } catch {
      setActionStatus(
        "Не удалось запланировать повторение. Попробуйте ещё раз",
      );
    } finally {
      setBusyAction("");
    }
  };
  const markKnown = async () => {
    setBusyAction("known");
    setActionStatus("");
    try {
      const currentWord = word.it;
      await advance();
      setActionStatus(`«${currentWord}» отмечено как знакомое`);
    } catch {
      setActionStatus("Не удалось сохранить прогресс. Попробуйте ещё раз");
    } finally {
      setBusyAction("");
    }
  };
  return (
    <Page
      eyebrow={`УРОК ${lesson.number} • ${lesson.minutes} МИНУТ`}
      title={lesson.title}
    >
      <div className="step">
        <span>
          Слово {index + 1} из {lesson.words.length}
        </span>
        <b>{Math.round(((index + 1) / lesson.words.length) * 100)}%</b>
      </div>
      <div className="bar">
        <i style={{ width: `${((index + 1) / lesson.words.length) * 100}%` }} />
      </div>
      <div className="lesson-layout">
        <article className="word-card">
          <p className="meta">ИТАЛЬЯНСКИЙ • IT</p>
          <h2 lang="it">{word.it}</h2>
          <button
            className="audio"
            onClick={() => speak(word.it)}
            aria-label={`Воспроизвести ${word.it}`}
          >
            <Volume2 /> 1×
          </button>
          <button className="audio" onClick={() => speak(word.it, 0.75)}>
            <Volume2 /> 0,75×
          </button>
          <button className="reveal" onClick={() => setShow(!show)}>
            {show ? "Скрыть перевод" : "Показать перевод"}
          </button>
          {show && (
            <div className="translation">
              <b>{word.ru}</b>
              <p>{word.example}</p>
              <small>{word.hint}</small>
            </div>
          )}
          <div className="row wrap">
            <button
              className="button ghost"
              onClick={goBack}
              disabled={index === 0 || Boolean(busyAction)}
            >
              <ChevronLeft /> Назад
            </button>
            <button
              className="button ghost"
              onClick={add}
              disabled={Boolean(busyAction)}
            >
              <Plus /> {busyAction === "add" ? "Добавляем…" : "В словарь"}
            </button>
            <button
              className="button ghost"
              onClick={markForReview}
              disabled={Boolean(busyAction)}
            >
              {busyAction === "review" ? "Сохраняем…" : "Повторить"}
            </button>
            <button
              className="button secondary"
              onClick={markKnown}
              disabled={Boolean(busyAction)}
            >
              {busyAction === "known" ? "Сохраняем…" : "Знаю"} <Check />
            </button>
          </div>
          {actionStatus && (
            <div className="feedback success" role="status" aria-live="polite">
              {actionStatus}
            </div>
          )}
        </article>
        <aside className="explain">
          <h3>Без сложных терминов</h3>
          <p>{lesson.explanation}</p>
          <h3>Практика</h3>
          <Link to={`/lessons/${lesson.id}/listening`}>
            Аудирование <ArrowRight />
          </Link>
          <Link to={`/lessons/${lesson.id}/pronunciation`}>
            Произношение <ArrowRight />
          </Link>
          <Link to={`/lessons/${lesson.id}/quiz`}>
            Итоговая проверка <ArrowRight />
          </Link>
        </aside>
      </div>
    </Page>
  );
}
function Listening() {
  const { lessonId } = useParams(),
    lesson = lessons.find((item) => item.id === lessonId) || lessons[0],
    tasks = useMemo(
      () =>
        lesson.words.slice(0, 5).map((word, index) => {
          const distractorA =
            lesson.words[(index + 2) % lesson.words.length].it;
          const distractorB =
            lesson.words[(index + 4) % lesson.words.length].it;
          return {
            target: word.it,
            translation: word.ru,
            example: word.example,
            options:
              index % 2 === 0
                ? [distractorA, word.it, distractorB]
                : [word.it, distractorB, distractorA],
          };
        }),
      [lesson],
    ),
    [taskIndex, setTaskIndex] = useState(0),
    [transcript, setTranscript] = useState(false),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    task = tasks[taskIndex],
    correct = answer === task.target,
    lastTask = taskIndex === tasks.length - 1;
  const continueListening = async () => {
    if (!answer || busy) return;
    setBusy(true);
    try {
      await api("/api/skill-attempt", {
        method: "POST",
        body: JSON.stringify({
          anonymousId: aid,
          lessonId: lesson.id,
          exerciseId: `listening-${taskIndex + 1}`,
          skillType: "listening",
          score: correct ? 100 : 40,
          targetText: task.target,
          recognizedText: answer,
          feedback: correct ? "Верно" : `В записи звучит ${task.target}`,
        }),
      });
      await api("/api/lesson-progress", {
        method: "POST",
        body: JSON.stringify({
          anonymousId: aid,
          lessonId: lesson.id,
          currentStep: 6,
          completionPercent: Math.round(
            60 + ((taskIndex + 1) / tasks.length) * 15,
          ),
          completed: false,
        }),
      });
      if (!lastTask) {
        const next = taskIndex + 1;
        setTaskIndex(next);
        setAnswer("");
        setTranscript(false);
        speak(tasks[next].target);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      eyebrow={`АУДИРОВАНИЕ • УРОК ${lesson.number} • IT`}
      title={`Слушаем: ${lesson.title}`}
    >
      <div className="practice">
        <div className="step">
          <span>
            Слово {taskIndex + 1} из {tasks.length}
          </span>
          <b>{Math.round(((taskIndex + 1) / tasks.length) * 100)}%</b>
        </div>
        <button className="listen" onClick={() => speak(task.target)}>
          <Play /> Прослушать
        </button>
        <div className="row">
          <button className="button ghost" onClick={() => speak(task.target)}>
            1×
          </button>
          <button
            className="button ghost"
            onClick={() => speak(task.target, 0.75)}
          >
            0,75×
          </button>
          <button
            className="button ghost"
            onClick={() => setTranscript(!transcript)}
          >
            {transcript ? "Скрыть" : "Показать"} транскрипт
          </button>
        </div>
        {transcript && (
          <div className="transcript">
            <b>Luca:</b> La parola è{" "}
            <button
              onClick={() =>
                api("/api/words", {
                  method: "POST",
                  body: JSON.stringify({
                    anonymousId: aid,
                    italian: task.target,
                    translation: task.translation,
                    lessonId: lesson.id,
                  }),
                })
              }
            >
              {task.target} +
            </button>
            . {task.example}
          </div>
        )}
        <fieldset>
          <legend>Что вы услышали?</legend>
          {task.options.map((x) => (
            <label className="option" key={x}>
              <input
                type="radio"
                name={`heard-${taskIndex}`}
                value={x}
                checked={answer === x}
                onChange={(e) => setAnswer(e.target.value)}
              />
              {x}
            </label>
          ))}
        </fieldset>
        {answer && (
          <div
            className={correct ? "feedback success" : "feedback"}
            aria-live="polite"
          >
            {correct
              ? `Верно! Вы услышали «${task.target}» — ${task.translation.toLocaleLowerCase("ru")}`
              : `Почти. Прослушайте ещё раз. В записи звучит ${task.target}.`}
          </div>
        )}
        {answer && !lastTask && (
          <button
            className="button primary listening-next"
            onClick={continueListening}
            disabled={busy}
          >
            {busy ? "Сохраняем…" : "Следующее слово"} <ArrowRight />
          </button>
        )}
        {answer && lastTask && (
          <div className="result">
            <h2>Аудирование завершено</h2>
            <p>Вы прослушали пять ключевых слов урока «{lesson.title}».</p>
            <button
              className="button primary"
              onClick={continueListening}
              disabled={busy}
            >
              {busy ? "Сохраняем…" : "Сохранить результат"}
            </button>
            <Link
              className="button secondary"
              to={`/lessons/${lesson.id}/pronunciation`}
            >
              Перейти к произношению <ArrowRight />
            </Link>
            <Link className="button ghost" to={`/lessons/${lesson.id}/quiz`}>
              Итоговая проверка
            </Link>
          </div>
        )}
      </div>
    </Page>
  );
}
function Pronunciation() {
  const { lessonId } = useParams(),
    lesson = lessons.find((item) => item.id === lessonId) || lessons[0],
    { data: profile } = useQuery({
      queryKey: ["profile"],
      queryFn: () => api<any>(`/api/profile/${aid}`),
    }),
    learnerName = italianName(profile?.name),
    target =
      lesson.id === "greetings"
        ? `Ciao, mi chiamo ${learnerName}. Piacere!`
        : lesson.words
            .slice(0, 5)
            .map((word) => word.it)
            .join(", ") + ".",
    targetParts =
      lesson.id === "greetings"
        ? ["Ciao", "mi chiamo", learnerName, "Piacere"]
        : lesson.words.slice(0, 5).map((word) => word.it),
    nav = useNavigate(),
    [state, setState] = useState("ожидание"),
    [text, setText] = useState(""),
    [seconds, setSeconds] = useState(0),
    [speechError, setSpeechError] = useState(""),
    attemptFinished = useRef(false),
    recognition = useMemo(createSpeechRecognition, []);
  useEffect(() => {
    let timer: number | undefined;
    if (state === "запись")
      timer = window.setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);
  useEffect(() => () => recognition.dispose(), [recognition]);
  const finish = async (transcript: string) => {
    if (attemptFinished.current) return;
    attemptFinished.current = true;
    const recognized = transcript.trim();
    setText(recognized);
    if (!recognized) {
      setSpeechError(
        "Речь не распознана. Нажмите «Произнести ещё раз» или введите фразу ниже.",
      );
      setState("не распознано");
      return;
    }
    setSpeechError("");
    setState("результат");
    const analysis = analyzePronunciation(target, recognized);
    try {
      await api("/api/skill-attempt", {
        method: "POST",
        body: JSON.stringify({
          anonymousId: aid,
          lessonId: lesson.id,
          exerciseId: `pronunciation-${lesson.id}`,
          skillType: "pronunciation",
          score: analysis.score,
          targetText: target,
          recognizedText: recognized,
          feedback: analysis.feedback,
        }),
      });
    } catch {
      // Оценка всё равно полезна локально, если сервер временно недоступен.
    }
  };
  const start = async () => {
    if (!localStorage.getItem("tutor-mic-consent")) {
      if (
        !confirm(
          "Микрофон используется только для распознавания текущей попытки. Аудиозапись не сохраняется. Разрешить?",
        )
      )
        return;
      localStorage.setItem("tutor-mic-consent", "1");
    }
    try {
      setSpeechError("");
      setText("");
      attemptFinished.current = false;
      setState("запрос разрешения");
      await recognition.start({
        onInterim: setText,
        onFinal: setText,
        onError: (code) => {
          const errors: Record<string, string> = {
            "no-speech":
              "Речь не услышана. Попробуйте говорить ближе к микрофону.",
            "audio-capture": "Браузер не получает звук с микрофона.",
            "not-allowed": "Доступ к микрофону запрещён в браузере.",
            network: "Сервис распознавания браузера недоступен по сети.",
            "cloud-503": "Серверное распознавание пока не настроено.",
            "cloud-500": "Groq Whisper не ответил. Проверьте ключ и прокси.",
            STT_NOT_CONFIGURED: "Серверное распознавание не настроено.",
            EMPTY_AUDIO:
              "Микрофон не передал аудио. Проверьте выбранный микрофон и повторите попытку.",
          };
          setSpeechError(errors[code] || `Ошибка распознавания: ${code}`);
        },
        onEnd: (transcript) => void finish(transcript),
      });
      setState("запись");
      setSeconds(0);
    } catch {
      setState("микрофон недоступен");
    }
  };
  const stop = async () => {
    setState("обработка");
    const r = await recognition.stop();
    if (r.error && !r.transcript.trim()) {
      setState("не распознано");
      return;
    }
    await finish(r.transcript);
  };
  const result = state === "результат" && analyzePronunciation(target, text);
  return (
    <Page
      eyebrow={`ПРОИЗНОШЕНИЕ • УРОК ${lesson.number} • IT`}
      title={
        lesson.id === "greetings"
          ? "Представьтесь уверенно"
          : `Тренируем: ${lesson.title}`
      }
    >
      <div className="practice">
        <p className="target" lang="it">
          {target}
        </p>
        <p>{targetParts.join(" · ")}</p>
        <small>
          Упрощённая подсказка для произношения, а не строгая фонетическая
          транскрипция.
        </small>
        <div className="row wrap">
          <button className="button secondary" onClick={() => speak(target)}>
            <Volume2 /> Послушать
          </button>
          <button className="button ghost" onClick={() => speak(target, 0.75)}>
            Медленно
          </button>
          <button
            className="button ghost"
            onClick={async () => {
              for (const part of targetParts) await speak(part, 0.75);
            }}
          >
            По частям
          </button>
        </div>
        <div className="recorder" aria-live="polite">
          <b>Состояние: {state}</b>
          {state === "запись" && (
            <span className="recording">● {seconds} сек.</span>
          )}
        </div>
        {state !== "запись" ? (
          <button className="button primary" onClick={start}>
            <Mic /> Начать запись
          </button>
        ) : (
          <button className="button primary" onClick={stop}>
            Остановить
          </button>
        )}
        <label>
          Текстовый режим
          <input
            value={text}
            placeholder="Введите произнесённую фразу"
            onChange={(e) => {
              setText(e.target.value);
              setState("результат");
            }}
          />
        </label>
        {(state === "микрофон недоступен" || speechError) && (
          <div className="feedback">
            {speechError ||
              "Микрофон или распознавание речи недоступны в этом браузере."}{" "}
            Вы можете продолжить упражнение в текстовом режиме.
          </div>
        )}
        {result && (
          <div className="result" aria-live="polite">
            <h2>{result.score}%</h2>
            <p>{result.feedback}</p>
            <small>{result.label}</small>
            <button
              className="button secondary"
              onClick={() => nav(`/lessons/${lesson.id}/quiz`)}
            >
              Перейти к итоговой проверке <ArrowRight />
            </button>
          </div>
        )}
        <button
          className="button ghost"
          onClick={() => {
            setText("");
            setSpeechError("");
            attemptFinished.current = false;
            setState("ожидание");
          }}
        >
          <RotateCcw /> Произнести ещё раз
        </button>
      </div>
    </Page>
  );
}
function Quiz() {
  const nav = useNavigate(),
    { lessonId } = useParams(),
    lesson = lessons.find((item) => item.id === lessonId) || lessons[0],
    isReading = lesson.id === "reading",
    isNumbers = lesson.id === "numbers",
    isCafe = lesson.id === "cafe",
    isCity = lesson.id === "city",
    isSecondBlock = lesson.number >= 6,
    { data: profile } = useQuery({
      queryKey: ["profile"],
      queryFn: () => api<any>(`/api/profile/${aid}`),
    }),
    learnerName = italianName(profile?.name),
    [answers, setAnswers] = useState({
      q1: "",
      q2: "",
      q3: "",
      q4: "",
      q5: "",
    }),
    [done, setDone] = useState(false),
    [quizListening, setQuizListening] = useState(false),
    [quizVoiceStatus, setQuizVoiceStatus] = useState(""),
    quizRecognition = useMemo(createSpeechRecognition, []),
    qc = useQueryClient();
  useEffect(() => () => quizRecognition.dispose(), [quizRecognition]);
  const startQuizVoice = async () => {
    if (!quizRecognition.isAvailable()) {
      setQuizVoiceStatus(
        "Микрофон недоступен. Откройте приложение по HTTPS или введите фразу.",
      );
      return;
    }
    try {
      setQuizVoiceStatus("Говорите фразу по-итальянски…");
      setQuizListening(true);
      await quizRecognition.start({
        onInterim: (value) =>
          setAnswers((current) => ({ ...current, q5: value })),
        onFinal: (value) =>
          setAnswers((current) => ({ ...current, q5: value })),
        onError: () => {
          setQuizListening(false);
          setQuizVoiceStatus(
            "Речь не распознана. Попробуйте ещё раз или введите фразу.",
          );
        },
        onEnd: (value) => {
          setQuizListening(false);
          if (value) {
            setAnswers((current) => ({ ...current, q5: value }));
            setQuizVoiceStatus("Фраза распознана и добавлена в ответ.");
          }
        },
      });
    } catch {
      setQuizListening(false);
      setQuizVoiceStatus(
        "Не удалось включить микрофон. Проверьте разрешение браузера.",
      );
    }
  };
  const stopQuizVoice = async () => {
    setQuizVoiceStatus("Распознаём фразу через Groq Whisper…");
    const result = await quizRecognition.stop();
    setQuizListening(false);
    if (result.transcript) {
      setAnswers((current) => ({ ...current, q5: result.transcript }));
      setQuizVoiceStatus("Фраза распознана и добавлена в ответ.");
    }
  };
  const pronunciationTarget = isReading
    ? `Ciao, mi chiamo ${learnerName}. A casa mangio gelato con la mia famiglia. Piacere!`
    : isNumbers
      ? `Ciao, mi chiamo ${learnerName}. Ho una famiglia e due case. Piacere!`
      : isCafe
        ? `Buongiorno, mi chiamo ${learnerName}. Vorrei un caffè e un'acqua, per favore. Quanto costa? Grazie.`
        : isCity
          ? "Buongiorno. Dov'è la stazione? Un biglietto per l'autobus, per favore. Grazie, arrivederci!"
          : isSecondBlock
            ? lesson.words.slice(0, 3).map((word) => word.it.replace("…", "")).join(". ") + "."
            : `Ciao, mi chiamo ${learnerName}. Piacere!`;
  const pronunciationResult = analyzePronunciation(
    pronunciationTarget,
    answers.q5,
  );
  const greetingsChecks = [
    {
      title: "Аудирование: Buongiorno",
      correct: answers.q1 === "Buongiorno",
      answer: answers.q1 || "Ответ не выбран",
      expected: "Buongiorno",
      tip: "Повторите звучание Buongiorno — «доброе утро / добрый день».",
    },
    {
      title: "Перевод: Come ti chiami?",
      correct: answers.q2 === "Как тебя зовут?",
      answer: answers.q2 || "Ответ не выбран",
      expected: "Как тебя зовут?",
      tip: "Come ti chiami? — вопрос об имени собеседника.",
    },
    {
      title: "Фраза знакомства",
      correct:
        answers.q3.toLowerCase().replace(/[.!?]/g, "").trim() ===
        `mi chiamo ${learnerName.toLowerCase()}`,
      answer: answers.q3 || "Ответ не введён",
      expected: `Mi chiamo ${learnerName}`,
      tip: "Сначала Mi, затем chiamo и имя.",
    },
    {
      title: "Перевод слова «Спасибо»",
      correct:
        answers.q4.toLowerCase().replace(/[.!?]/g, "").trim() === "grazie",
      answer: answers.q4 || "Ответ не введён",
      expected: "Grazie",
      tip: "Повторите: Grazie — «спасибо».",
    },
    {
      title: "Произношение представления",
      correct: pronunciationResult.score >= 70,
      answer: answers.q5 || "Речь не распознана",
      expected: pronunciationTarget,
      tip: `${pronunciationResult.feedback} Совпадение: ${pronunciationResult.score}%.`,
    },
  ];
  const readingChecks = [
    {
      title: "Аудирование: casa",
      correct: answers.q1 === "casa",
      answer: answers.q1 || "Ответ не выбран",
      expected: "casa",
      tip: "Casa произносится с твёрдым звуком c и означает «дом».",
    },
    {
      title: "Значение слова cena",
      correct: answers.q2 === "ужин",
      answer: answers.q2 || "Ответ не выбран",
      expected: "ужин",
      tip: "Перед e буква c в слове cena звучит мягче.",
    },
    {
      title: "Итальянское слово «кто»",
      correct: answers.q3.toLowerCase().replace(/[.!?]/g, "").trim() === "chi",
      answer: answers.q3 || "Ответ не введён",
      expected: "chi",
      tip: "Сочетание ch сохраняет твёрдый звук: chi.",
    },
    {
      title: "Итальянское слово «мороженое»",
      correct:
        answers.q4.toLowerCase().replace(/[.!?]/g, "").trim() === "gelato",
      answer: answers.q4 || "Ответ не введён",
      expected: "gelato",
      tip: "Повторите: gelato — мороженое.",
    },
    {
      title: "Накопительная фраза: уроки 1 и 2",
      correct: pronunciationResult.score >= 70,
      answer: answers.q5 || "Речь не распознана",
      expected: pronunciationTarget,
      tip: `${pronunciationResult.feedback} Совпадение: ${pronunciationResult.score}%.`,
    },
  ];
  const numbersChecks = [
    {
      title: "Аудирование: sette",
      correct: answers.q1 === "sette",
      answer: answers.q1 || "Ответ не выбран",
      expected: "sette",
      tip: "Sette — число 7.",
    },
    {
      title: "Число dodici",
      correct: answers.q2 === "12",
      answer: answers.q2 || "Ответ не выбран",
      expected: "12",
      tip: "Dodici — двенадцать.",
    },
    {
      title: "Число 3 по-итальянски",
      correct: answers.q3.toLowerCase().trim() === "tre",
      answer: answers.q3 || "Ответ не введён",
      expected: "tre",
      tip: "Повторите ряд: uno, due, tre.",
    },
    {
      title: "Число 20 по-итальянски",
      correct: answers.q4.toLowerCase().trim() === "venti",
      answer: answers.q4 || "Ответ не введён",
      expected: "venti",
      tip: "Venti — двадцать.",
    },
    {
      title: "Накопительная фраза: уроки 1–3",
      correct: pronunciationResult.score >= 70,
      answer: answers.q5 || "Речь не распознана",
      expected: pronunciationTarget,
      tip: `${pronunciationResult.feedback} Совпадение: ${pronunciationResult.score}%.`,
    },
  ];
  const cafeChecks = [
    {
      title: "Аудирование: un caffè",
      correct: answers.q1 === "un caffè",
      answer: answers.q1 || "Ответ не выбран",
      expected: "un caffè",
      tip: "Un caffè — один кофе.",
    },
    {
      title: "Перевод: Quanto costa?",
      correct: answers.q2 === "Сколько стоит?",
      answer: answers.q2 || "Ответ не выбран",
      expected: "Сколько стоит?",
      tip: "Quanto costa? помогает узнать цену.",
    },
    {
      title: "Заказ воды",
      correct: ["un'acqua", "un’acqua"].includes(
        answers.q3.toLowerCase().trim(),
      ),
      answer: answers.q3 || "Ответ не введён",
      expected: "un’acqua",
      tip: "Для заказа воды: un’acqua.",
    },
    {
      title: "Просьба принести счёт",
      correct: answers.q4.toLowerCase().trim() === "il conto",
      answer: answers.q4 || "Ответ не введён",
      expected: "il conto",
      tip: "Il conto — счёт.",
    },
    {
      title: "Накопительная фраза: уроки 1–4",
      correct: pronunciationResult.score >= 70,
      answer: answers.q5 || "Речь не распознана",
      expected: pronunciationTarget,
      tip: `${pronunciationResult.feedback} Совпадение: ${pronunciationResult.score}%.`,
    },
  ];
  const cityChecks = [
    {
      title: "Аудирование: la stazione",
      correct: answers.q1 === "la stazione",
      answer: answers.q1 || "Ответ не выбран",
      expected: "la stazione",
      tip: "La stazione — станция.",
    },
    {
      title: "Перевод: Dov'è…?",
      correct: answers.q2 === "Где…?",
      answer: answers.q2 || "Ответ не выбран",
      expected: "Где…?",
      tip: "Dov'è…? — вопрос о местонахождении.",
    },
    {
      title: "Слово «билет»",
      correct: answers.q3.toLowerCase().trim() === "il biglietto",
      answer: answers.q3 || "Ответ не введён",
      expected: "il biglietto",
      tip: "Il biglietto — билет.",
    },
    {
      title: "Направление «налево»",
      correct: answers.q4.toLowerCase().trim() === "a sinistra",
      answer: answers.q4 || "Ответ не введён",
      expected: "a sinistra",
      tip: "A sinistra — налево.",
    },
    {
      title: "Накопительная фраза: уроки 1–5",
      correct: pronunciationResult.score >= 70,
      answer: answers.q5 || "Речь не распознана",
      expected: pronunciationTarget,
      tip: `${pronunciationResult.feedback} Совпадение: ${pronunciationResult.score}%.`,
    },
  ];
  const normalizeAnswer = (value: string) => value.toLocaleLowerCase("it").replace(/[.!?…]/g, "").replace(/['’]/g, "'").trim();
  const secondBlockChecks = [
    { title: `Аудирование: ${lesson.words[0].it}`, correct: answers.q1 === lesson.words[0].it, answer: answers.q1 || "Ответ не выбран", expected: lesson.words[0].it, tip: `Повторите звучание: ${lesson.words[0].it}.` },
    { title: `Перевод: ${lesson.words[1].it}`, correct: answers.q2 === lesson.words[1].ru, answer: answers.q2 || "Ответ не выбран", expected: lesson.words[1].ru, tip: `${lesson.words[1].it} — ${lesson.words[1].ru}.` },
    { title: `Фраза «${lesson.words[2].ru}»`, correct: normalizeAnswer(answers.q3) === normalizeAnswer(lesson.words[2].it), answer: answers.q3 || "Ответ не введён", expected: lesson.words[2].it, tip: `Правильная модель: ${lesson.words[2].it}.` },
    { title: `Фраза «${lesson.words[3].ru}»`, correct: normalizeAnswer(answers.q4) === normalizeAnswer(lesson.words[3].it), answer: answers.q4 || "Ответ не введён", expected: lesson.words[3].it, tip: `Правильная модель: ${lesson.words[3].it}.` },
    { title: `Накопительная фраза: уроки 1–${lesson.number}`, correct: pronunciationResult.score >= 70, answer: answers.q5 || "Речь не распознана", expected: pronunciationTarget, tip: `${pronunciationResult.feedback} Совпадение: ${pronunciationResult.score}%.` },
  ];
  const checks = isSecondBlock
    ? secondBlockChecks
    : isReading
    ? readingChecks
    : isNumbers
      ? numbersChecks
      : isCafe
        ? cafeChecks
        : isCity
          ? cityChecks
          : greetingsChecks;
  const score = checks.filter((check) => check.correct).length * 20;
  const quizUi = isReading
    ? {
        audio: "casa",
        q1: ["cena", "casa", "gelato"],
        q2Label: "Что означает cena?",
        q2: ["ужин", "дом", "семья"],
        q3Label: "Введите итальянское слово «кто»",
        q3Placeholder: "chi",
        q4Label: "Переведите «мороженое»",
      }
    : isNumbers
      ? {
          audio: "sette",
          q1: ["sei", "sette", "otto"],
          q2Label: "Какое число означает dodici?",
          q2: ["10", "12", "20"],
          q3Label: "Напишите число 3 по-итальянски",
          q3Placeholder: "tre",
          q4Label: "Напишите число 20 по-итальянски",
        }
      : isCafe
        ? {
            audio: "un caffè",
            q1: ["un’acqua", "un caffè", "il conto"],
            q2Label: "Что означает Quanto costa?",
            q2: ["Сколько стоит?", "Где кафе?", "Принесите счёт"],
            q3Label: "Напишите «вода» для заказа",
            q3Placeholder: "un’acqua",
            q4Label: "Напишите «счёт» по-итальянски",
          }
        : isCity
          ? {
              audio: "la stazione",
              q1: ["l’autobus", "la stazione", "il biglietto"],
              q2Label: "Что означает Dov'è…?",
              q2: ["Где…?", "Сколько стоит?", "Куда?"],
              q3Label: "Напишите «билет» по-итальянски",
              q3Placeholder: "il biglietto",
              q4Label: "Напишите «налево» по-итальянски",
            }
          : isSecondBlock
            ? {
                audio: lesson.words[0].it,
                q1: [lesson.words[1].it, lesson.words[0].it, lesson.words[4].it],
                q2Label: `Что означает ${lesson.words[1].it}?`,
                q2: [lesson.words[1].ru, lesson.words[3].ru, lesson.words[5].ru],
                q3Label: `Напишите по-итальянски: «${lesson.words[2].ru}»`,
                q3Placeholder: lesson.words[2].it,
                q4Label: `Напишите по-итальянски: «${lesson.words[3].ru}»`,
              }
            : {
              audio: "Buongiorno",
              q1: ["Grazie", "Buongiorno", "Prego"],
              q2Label: "Come ti chiami?",
              q2: ["Как тебя зовут?", "Как дела?"],
              q3Label: `Соберите из ${learnerName} · chiamo · Mi`,
              q3Placeholder: `Mi chiamo ${learnerName}`,
              q4Label: "Переведите «Спасибо»",
            };
  const finish = async () => {
    setDone(true);
    await api("/api/lesson-progress", {
      method: "POST",
      body: JSON.stringify({
        anonymousId: aid,
        lessonId: lesson.id,
        currentStep: Math.min(lesson.words.length, 20),
        completionPercent: 100,
        completed: true,
        score,
      }),
    });
    qc.invalidateQueries({ queryKey: ["progress"] });
  };
  return (
    <Page
      eyebrow={`ФИНАЛЬНАЯ ПРОВЕРКА • УРОК ${lesson.number}`}
      title={`Проверяем: ${lesson.title}`}
    >
      <div className="quiz">
        <label>
          1.{" "}
          <button className="audio" onClick={() => speak(quizUi.audio)}>
            <Play /> Прослушать
          </button>
          <select
            value={answers.q1}
            onChange={(e) => setAnswers({ ...answers, q1: e.target.value })}
          >
            <option value="">Выберите фразу</option>
            {quizUi.q1.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          2. {quizUi.q2Label}
          <select
            value={answers.q2}
            onChange={(e) => setAnswers({ ...answers, q2: e.target.value })}
          >
            <option value="">Выберите перевод</option>
            {quizUi.q2.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          3. {quizUi.q3Label}
          <input
            placeholder={quizUi.q3Placeholder}
            value={answers.q3}
            onChange={(e) => setAnswers({ ...answers, q3: e.target.value })}
          />
        </label>
        <label>
          4. {quizUi.q4Label}
          <input
            value={answers.q4}
            onChange={(e) => setAnswers({ ...answers, q4: e.target.value })}
          />
        </label>
        <label>
          5. Произнесите или введите фразу
          <button
            type="button"
            className={quizListening ? "mic-button recording" : "mic-button"}
            onClick={quizListening ? stopQuizVoice : startQuizVoice}
          >
            <Mic /> {quizListening ? "Остановить запись" : "Произнести"}
          </button>
          <input
            placeholder={pronunciationTarget}
            value={answers.q5}
            onChange={(e) => setAnswers({ ...answers, q5: e.target.value })}
          />
          {quizVoiceStatus && (
            <small className="voice-status" aria-live="polite">
              {quizVoiceStatus}
            </small>
          )}
        </label>
        <button className="button primary" onClick={finish}>
          Проверить
        </button>
        {done && (
          <div className="result">
            <h2>{score}/100</h2>
            <p>
              {score === 100
                ? "Все задания выполнены верно. Отличная работа!"
                : `Верно выполнено ${score / 20} из 5 заданий. Ниже показано, что стоит повторить.`}
            </p>
            <div className="result-analysis">
              {checks.map((check, index) => (
                <article
                  key={check.title}
                  className={check.correct ? "correct" : "incorrect"}
                >
                  <b>
                    {check.correct ? "✓" : "Нужно повторить:"} {index + 1}.{" "}
                    {check.title}
                  </b>
                  {!check.correct && (
                    <>
                      <span>Ваш ответ: {check.answer}</span>
                      <span>Правильный вариант: {check.expected}</span>
                      <small>{check.tip}</small>
                    </>
                  )}
                </article>
              ))}
            </div>
            <button className="button secondary" onClick={() => nav("/")}>
              Завершить урок
            </button>
            <button className="button ghost" onClick={() => setDone(false)}>
              Повторить сложные задания
            </button>
          </div>
        )}
      </div>
    </Page>
  );
}
const examTasks = [
  { skill: "Словарь", prompt: "1. Напишите «Спасибо» по-итальянски", expected: "Grazie" },
  { skill: "Чтение", prompt: "2. Напишите итальянское слово «кто»", expected: "chi" },
  { skill: "Числа и время", prompt: "3. Напишите число 12 по-итальянски", expected: "dodici" },
  { skill: "Кафе", prompt: "4. Попросите счёт", expected: "il conto" },
  { skill: "Город", prompt: "5. Спросите: «Где станция?»", expected: "Dov'è la stazione?" },
  { skill: "Отель", prompt: "6. Скажите: «У меня есть бронь»", expected: "Ho una prenotazione" },
  { skill: "Время", prompt: "7. Спросите: «Во сколько?»", expected: "A che ora?" },
  { skill: "Еда", prompt: "8. Закажите пиццу без сыра", expected: "Vorrei una pizza senza formaggio" },
  { skill: "Покупки", prompt: "9. Спросите, можно ли оплатить картой", expected: "Posso pagare con la carta?" },
  { skill: "Помощь", prompt: "10. Скажите: «Извините, мне нужна помощь»", expected: "Mi scusi, ho bisogno di aiuto" },
] as const;

function MiniExam() {
  const { data: progress, isLoading } = useQuery({ queryKey: ["progress"], queryFn: () => api<any>(`/api/progress/${aid}`) });
  const [answers, setAnswers] = useState<string[]>(Array(examTasks.length).fill(""));
  const [result, setResult] = useState<{ score: number; details: { skill: string; score: number; expected: string }[] } | null>(null);
  const qc = useQueryClient();
  const firstTwoBlocks = lessons.filter((lesson) => lesson.number <= 10);
  const completed = firstTwoBlocks.filter((lesson) => progress?.lessons?.some((item: any) => item.lessonId === lesson.id && item.completed)).length;
  const ready = completed === firstTwoBlocks.length;
  const finish = async () => {
    try {
      const response = await api<any>("/api/exam/blocks-1-2", { method: "POST", body: JSON.stringify({ anonymousId: aid, answers }) });
      setResult({ score: response.score, details: response.details.map((detail: any, index: number) => ({ ...detail, skill: examTasks[index].skill })) });
      await qc.invalidateQueries({ queryKey: ["progress"] });
    } catch { setResult({ score: 0, details: examTasks.map((task) => ({ skill: task.skill, score: 0, expected: task.expected })) }); }
  };
  if (isLoading) return <Page title="Мини-экзамен"><p>Проверяем готовность…</p></Page>;
  return (
    <Page eyebrow="БЛОКИ 1–2 • УРОКИ 1–10" title="Мини-экзамен: один день в Италии">
      <p className="lead">Десять коротких ситуаций проверяют материал обоих блоков. Можно вводить ответы без точки; регистр не учитывается.</p>
      {!ready && <div className="feedback" role="status">Завершено уроков: {completed} из {firstTwoBlocks.length}. Экзамен откроется после итоговой проверки урока 10.</div>}
      <div className="quiz">
        {examTasks.map((task, index) => (
          <label key={task.prompt}>{task.prompt}<input value={answers[index]} onChange={(event) => setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? event.target.value : value))} disabled={!ready || Boolean(result)} /></label>
        ))}
        <button className="button primary" onClick={finish} disabled={!ready || answers.some((answer) => !answer.trim()) || Boolean(result)}>Завершить мини-экзамен</button>
        {result && <div className="result" aria-live="polite">
          <h2>{result.score}/100</h2>
          <p>{result.score >= 80 ? "Мини-экзамен сдан. Можно переходить к следующему блоку!" : result.score >= 60 ? "Зачёт получен, но слабые темы лучше повторить." : "Повторите отмеченные темы и попробуйте снова."}</p>
          <div className="result-analysis">{result.details.map((item) => <article key={item.skill} className={item.score >= 70 ? "correct" : "incorrect"}><b>{item.skill}: {item.score}%</b>{item.score < 70 && <span>Модель ответа: {item.expected}</span>}</article>)}</div>
          <button className="button secondary" onClick={() => { setResult(null); setAnswers(Array(examTasks.length).fill("")); }}>Пройти ещё раз</button>
        </div>}
      </div>
    </Page>
  );
}

const tutorStarts: Record<string, { it: string; ru: string; examples: string[] }> = {
  intro: { it: "Ciao! Io mi chiamo Luca. Come ti chiami?", ru: "Привет! Меня зовут Лука. Как вас зовут?", examples: ["Mi chiamo {name}.", "Piacere!", "Bene, grazie."] },
  cafe: { it: "Buongiorno! Cosa desidera?", ru: "Добрый день! Что желаете?", examples: ["Vorrei un caffè, per favore.", "Una pizza senza formaggio.", "Il conto, per favore."] },
  ticket: { it: "Buongiorno. Dove vuole andare?", ru: "Добрый день. Куда вы хотите поехать?", examples: ["Un biglietto, per favore.", "Dov'è la stazione?", "Grazie, arrivederci."] },
  hotel: { it: "Buonasera. Ha una prenotazione?", ru: "Добрый вечер. У вас есть бронь?", examples: ["Ho una prenotazione.", "Mi chiamo {name}.", "Dov'è la camera?"] },
  time: { it: "Ci vediamo oggi?", ru: "Увидимся сегодня?", examples: ["A che ora?", "Alle tre va bene.", "Ci vediamo domani."] },
  food: { it: "Ha fame? Che cosa le piace?", ru: "Вы голодны? Что вам нравится?", examples: ["Ho fame.", "Mi piace la pizza.", "Senza formaggio, per favore."] },
  shopping: { it: "Buongiorno. Posso aiutarla?", ru: "Добрый день. Могу вам помочь?", examples: ["Vorrei questo rosso.", "Quanto costa?", "Posso pagare con la carta?"] },
  directions: { it: "Buongiorno. Dove deve andare?", ru: "Добрый день. Куда вам нужно?", examples: ["Dov'è la stazione?", "A destra?", "È vicino?"] },
  help: { it: "Certo, mi dica. Che cosa è successo?", ru: "Конечно, расскажите. Что случилось?", examples: ["Ho perso il biglietto.", "Ho bisogno di aiuto.", "Può ripetere più lentamente?"] },
  home: { it: "Parlami della tua famiglia.", ru: "Расскажите о своей семье.", examples: ["Questa è la mia famiglia.", "Abito a Roma.", "Ci sono due camere."] },
  routine: { it: "A che ora ti svegli?", ru: "Во сколько вы просыпаетесь?", examples: ["Mi sveglio alle sette.", "Vado al lavoro.", "Torno alle sei."] },
  weather: { it: "Che tempo fa oggi?", ru: "Какая сегодня погода?", examples: ["Fa freddo.", "C'è il sole.", "Piove, prendo l'ombrello."] },
  health: { it: "Buongiorno. Come si sente?", ru: "Добрый день. Как вы себя чувствуете?", examples: ["Non sto bene.", "Ho mal di testa.", "Devo vedere un medico."] },
  plans: { it: "Che cosa fai domani sera?", ru: "Что вы делаете завтра вечером?", examples: ["Vuoi andare al cinema?", "Volentieri!", "Ci vediamo alle otto."] },
};

function Tutor() {
  const { data: profile } = useQuery({
      queryKey: ["profile"],
      queryFn: () => api<any>(`/api/profile/${aid}`),
    }),
    { data: progress } = useQuery({ queryKey: ["progress"], queryFn: () => api<any>(`/api/progress/${aid}`) }),
    thirdBlockUnlocked = hasPassedSecondBlockExam(progress),
    learnerName = italianName(profile?.name),
    intro = {
      role: "assistant",
      text: "Ciao! Io mi chiamo Luca. Come ti chiami?",
      textRussian: "Привет! Меня зовут Лука. Как вас зовут?",
    },
    [scenario, setScenario] = useState("intro"),
    [input, setInput] = useState(""),
    [messages, setMessages] = useState<any[]>([intro]),
    [voiceState, setVoiceState] = useState(
      "Нажмите микрофон и ответьте по-итальянски",
    ),
    [listening, setListening] = useState(false),
    recognition = useMemo(createSpeechRecognition, []);
  const speakReply = async (italian: string, russian: string) => {
    setVoiceState("Слушайте итальянскую реплику");
    try {
      await tts.speak(italian, { lang: "it-IT", rate: 0.92 });
      setVoiceState("Слушайте перевод");
      await tts.speak(russian, { lang: "ru-RU", rate: 1 });
      setVoiceState("Теперь ответьте по-итальянски");
    } catch {
      setVoiceState(
        "Озвучка недоступна. Прочитайте реплику и ответьте текстом",
      );
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(
      () => speakReply(intro.text, intro.textRussian),
      350,
    );
    return () => {
      clearTimeout(timer);
      recognition.dispose();
      tts.stop();
    };
  }, [recognition, intro.text, intro.textRussian]);
  const mutation = useMutation({
    mutationFn: (message: string) =>
      api<any>("/api/tutor", {
        method: "POST",
        body: JSON.stringify({
          anonymousId: aid,
          message,
          scenario,
          history: messages
            .slice(-8)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      }),
    onSuccess: (r) => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: r.replyItalian,
          textRussian: r.replyRussian,
          data: r,
        },
      ]);
      speakReply(r.replyItalian, r.replyRussian);
    },
    onError: () =>
      setVoiceState("Не удалось получить ответ. Попробуйте ещё раз"),
  });
  const send = (spoken?: string) => {
    const value = (spoken ?? input).trim();
    if (!value || mutation.isPending) return;
    setMessages((m) => [...m, { role: "user", text: value }]);
    mutation.mutate(value);
    setInput("");
    setVoiceState("Репетитор готовит ответ");
  };
  const startVoice = async () => {
    if (!recognition.isAvailable()) {
      setVoiceState(
        "Распознавание недоступно по HTTP. Используйте текст или откройте приложение через HTTPS",
      );
      return;
    }
    if (!localStorage.getItem("tutor-mic-consent")) {
      if (
        !confirm(
          "Микрофон используется только для текущей попытки. Аудиозапись не сохраняется. Разрешить?",
        )
      )
        return;
      localStorage.setItem("tutor-mic-consent", "1");
    }
    try {
      tts.stop();
      setVoiceState("Говорите по-итальянски…");
      setListening(true);
      await recognition.start({
        onInterim: (value) => setInput(value),
        onFinal: (value) => setInput(value),
        onError: (code) => {
          setListening(false);
          const errors: Record<string, string> = {
            "no-speech":
              "Речь не услышана. Говорите ближе к микрофону после появления красного индикатора",
            "audio-capture":
              "Браузер не получает звук с микрофона. Проверьте выбранное устройство",
            "not-allowed": "Доступ к микрофону запрещён в настройках браузера",
            "service-not-allowed":
              "Сервис распознавания заблокирован браузером или политикой сети",
            network:
              "Сервис распознавания браузера недоступен по сети. Используйте текстовый режим или облачный STT",
            "cloud-503": "Серверное распознавание пока не настроено",
            "cloud-500": "Groq Whisper не ответил. Проверьте ключ и прокси",
            "language-not-supported":
              "Браузер не поддерживает распознавание итальянского языка",
            aborted: "Распознавание остановлено",
          };
          setVoiceState(errors[code] || `Ошибка распознавания: ${code}`);
        },
        onEnd: (value) => {
          setListening(false);
          if (value)
            setVoiceState(
              "Фраза распознана. Проверьте текст и нажмите «Отправить»",
            );
        },
      });
    } catch {
      setListening(false);
      setVoiceState(
        "Не удалось включить микрофон. Разрешите доступ в настройках браузера",
      );
    }
  };
  const stopVoice = async () => {
    setVoiceState("Распознаём ответ…");
    const result = await recognition.stop();
    setListening(false);
    setInput(result.transcript);
    if (result.transcript.trim()) send(result.transcript);
    else
      setVoiceState("Речь не распознана. Попробуйте ещё раз или введите ответ");
  };
  const chooseScenario = (id: string, title: string) => {
    const start = tutorStarts[id] || { it: `Iniziamo: ${title}.`, ru: `Начинаем сценарий «${title}».`, examples: [] };
    const italian = start.it;
    const russian = start.ru;
    setScenario(id);
    setMessages([{ role: "assistant", text: italian, textRussian: russian }]);
    speakReply(italian, russian);
  };
  const examples = tutorStarts[scenario].examples.map((example) => example.replaceAll("{name}", learnerName));
  return (
    <Page eyebrow="ГОЛОСОВОЙ AI • УРОВЕНЬ A0" title="Поговорим по-итальянски">
      <div className="voice-guide">
        <Volume2 />
        <div>
          <b>Сначала слушайте, потом отвечайте</b>
          <span>
            Репетитор говорит по-итальянски, переводит на русский и ждёт ваш
            ответ.
          </span>
        </div>
      </div>
      <div className="scenario-row">
        {scenarios.map((s) => (
          <button
            key={s.id}
            className={scenario === s.id ? "selected" : ""}
            onClick={() => chooseScenario(s.id, s.title)}
            disabled={!thirdBlockUnlocked && (lessons.find((lesson) => lesson.id === s.lessonId)?.number || 0) >= 11}
          >
            <b>{s.title}</b>
            <small>
              {!thirdBlockUnlocked && (lessons.find((lesson) => lesson.id === s.lessonId)?.number || 0) >= 11 ? "🔒 После экзамена" : `${s.goal} • ${s.minutes} мин`}
            </small>
          </button>
        ))}
      </div>
      <div className="chat" aria-live="polite">
        {messages.map((m, i) => (
          <div className={`bubble ${m.role}`} key={i}>
            <div className="spoken-line">
              <p lang={m.role === "assistant" ? "it" : undefined}>{m.text}</p>
              {m.role === "assistant" && (
                <button
                  className="icon"
                  onClick={() =>
                    speakReply(
                      m.text,
                      m.textRussian || m.data?.replyRussian || "",
                    )
                  }
                  aria-label="Прослушать реплику и перевод"
                >
                  <Volume2 />
                </button>
              )}
            </div>
            {m.textRussian && (
              <p className="translation-line">{m.textRussian}</p>
            )}
            {m.data && (
              <div className="correction">
                <b>Ваша фраза</b>
                <span>{m.data.original}</span>
                <b>Исправленный вариант</b>
                <span>{m.data.corrected}</span>
                <b>Почему так</b>
                <span>{m.data.explanationRu}</span>
                {m.data.naturalVariant && (
                  <>
                    <b>Более естественный вариант</b>
                    <span>{m.data.naturalVariant}</span>
                  </>
                )}
                <b>Следующий шаг</b>
                <span>{m.data.nextQuestion}</span>
                <em>
                  {m.data.mode === "live"
                    ? "Live AI · OpenRouter"
                    : m.data.mode === "fallback"
                      ? "OpenRouter недоступен · Демо AI"
                      : "Демо AI"}
                </em>
              </div>
            )}
          </div>
        ))}
        {mutation.isPending && (
          <div className="bubble assistant">Думаю над короткой подсказкой…</div>
        )}
      </div>
      <div className="voice-status" aria-live="polite">
        <span className={listening ? "voice-dot active" : "voice-dot"} />
        <b>{voiceState}</b>
      </div>
      <div className="examples">
        <span>Можно ответить так:</span>
        {examples.map((example) => (
          <button key={example} onClick={() => setInput(example)}>
            {example}
          </button>
        ))}
      </div>
      <div className="composer voice-composer">
        <button
          className={listening ? "mic-button recording" : "mic-button"}
          onClick={listening ? stopVoice : startVoice}
          aria-label={listening ? "Остановить и отправить" : "Ответить голосом"}
        >
          <Mic />
          {listening ? "Остановить" : "Ответить голосом"}
        </button>
        <label className="sr-only" htmlFor="tutor-input">
          Ваш ответ
        </label>
        <input
          id="tutor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Например: Mi chiamo ${learnerName}`}
        />
        <button
          className="button primary"
          onClick={() => send()}
          disabled={mutation.isPending || !input.trim()}
        >
          Отправить
        </button>
      </div>
      <small className="privacy-note">
        Микрофон используется только для текущей попытки. Аудио не сохраняется.
        Всегда доступен текстовый режим.
      </small>
    </Page>
  );
}
function VocabularyTraining() {
  const { data: progress, isLoading } = useQuery({
      queryKey: ["progress"],
      queryFn: () => api<any>(`/api/progress/${aid}`),
    }),
    { data: profile } = useQuery({
      queryKey: ["profile"],
      queryFn: () => api<any>(`/api/profile/${aid}`),
    }),
    [mode, setMode] = useState<TrainingMode>("words"),
    words = useMemo(() => {
      const name = italianName(profile?.name);
      return lessons.flatMap((lesson) => {
        const saved = progress?.lessons?.find(
          (item: any) => item.lessonId === lesson.id,
        );
        if (!saved) return [];
        if (mode !== "words") {
          const material = connectedTraining[lesson.id]?.[mode] || [];
          const learnedWords = saved.completed
            ? lesson.words.length
            : Math.min((saved.currentStep ?? 0) + 1, lesson.words.length);
          const unlockedCount = saved.completed
            ? material.length
            : Math.min(
                material.length,
                Math.max(1, Math.ceil((learnedWords / lesson.words.length) * material.length)),
              );
          return material.slice(0, unlockedCount).map((item) => ({
            it: item.it.replaceAll("{name}", name),
            ru: item.ru.replaceAll("{name}", profile?.name || name),
            example: item.it,
            hint: "Связная речь",
            lessonId: lesson.id,
            lessonTitle: lesson.title,
          }));
        }
        const count = saved.completed
          ? lesson.words.length
          : Math.min(
              Math.max(
                (saved.currentStep ?? 0) + 1,
                Math.ceil((saved.completionPercent / 60) * lesson.words.length),
              ),
              lesson.words.length,
            );
        return lesson.words.slice(0, count).map((word) => ({
          ...word,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
        }));
      });
    }, [mode, profile?.name, progress]),
    [order, setOrder] = useState<number[]>([]),
    [position, setPosition] = useState(0),
    [answer, setAnswer] = useState(""),
    [feedback, setFeedback] = useState<{
      score: number;
      correct: boolean;
      message: string;
    } | null>(null),
    [points, setPoints] = useState(0),
    [listening, setListening] = useState(false),
    [voiceStatus, setVoiceStatus] = useState(""),
    recognition = useMemo(createSpeechRecognition, []);
  useEffect(() => () => recognition.dispose(), [recognition]);
  useEffect(() => {
    setOrder([]);
    setPosition(0);
    setAnswer("");
    setFeedback(null);
    setPoints(0);
    setVoiceStatus("");
  }, [mode]);
  useEffect(() => {
    if (!words.length || order.length) return;
    const indexes = words.map((_, index) => index);
    for (let index = indexes.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
    }
    setOrder(
      Array.from({ length: 10 }, (_, index) => indexes[index % indexes.length]),
    );
  }, [words, order.length]);
  const word = words[order[position]],
    finished = position >= 10;
  const evaluate = async (value = answer) => {
    if (!word || !value.trim() || feedback) return;
    const result = analyzePronunciation(word.it, value),
      correct = result.score >= 70;
    setPoints(
      (current) => current + (correct ? 10 : Math.round(result.score / 10)),
    );
    setFeedback({ score: result.score, correct, message: result.feedback });
    try {
      await api("/api/skill-attempt", {
        method: "POST",
        body: JSON.stringify({
          anonymousId: aid,
          lessonId: word.lessonId,
          exerciseId: `vocabulary-training-${mode}`,
          skillType: "pronunciation",
          score: result.score,
          targetText: word.it,
          recognizedText: value,
          feedback: result.feedback,
        }),
      });
    } catch {
      /* Результат текущей сессии остаётся доступен без сервера. */
    }
  };
  const startVoice = async () => {
    if (!recognition.isAvailable())
      return setVoiceStatus(
        "Микрофон недоступен. Используйте HTTPS или введите ответ.",
      );
    try {
      setAnswer("");
      setVoiceStatus(
        mode === "words"
          ? "Произнесите итальянское слово…"
          : "Произнесите фразу по-итальянски…",
      );
      setListening(true);
      await recognition.start({
        onInterim: setAnswer,
        onFinal: setAnswer,
        onError: () => {
          setListening(false);
          setVoiceStatus(
            "Речь не распознана. Попробуйте снова или введите слово.",
          );
        },
        onEnd: (value) => {
          setListening(false);
          if (value) {
            setAnswer(value);
            setVoiceStatus("Ответ распознан. Нажмите «Проверить».");
          }
        },
      });
    } catch {
      setListening(false);
      setVoiceStatus("Не удалось включить микрофон.");
    }
  };
  const stopVoice = async () => {
    setVoiceStatus("Распознаём через Groq Whisper…");
    const result = await recognition.stop();
    setListening(false);
    if (result.transcript) {
      setAnswer(result.transcript);
      setVoiceStatus("Ответ распознан. Нажмите «Проверить».");
    }
  };
  const next = () => {
    setPosition((current) => current + 1);
    setAnswer("");
    setFeedback(null);
    setVoiceStatus("");
  };
  const restart = () => {
    setOrder([]);
    setPosition(0);
    setAnswer("");
    setFeedback(null);
    setPoints(0);
  };
  const modeLabels: Record<
    TrainingMode,
    { title: string; description: string }
  > = {
    words: { title: "Слова", description: "Отдельные пройденные слова" },
    phrases: { title: "Словосочетания", description: "Связки из 2–3 слов" },
    sentences: {
      title: "Простые предложения",
      description: "Короткие фразы из знакомого материала",
    },
  };
  const modeSelector = (
    <div className="training-modes" aria-label="Режим тренировки">
      {(Object.keys(modeLabels) as TrainingMode[]).map((value) => (
        <button
          key={value}
          className={mode === value ? "selected" : ""}
          onClick={() => setMode(value)}
          aria-pressed={mode === value}
        >
          <b>{modeLabels[value].title}</b>
          <small>{modeLabels[value].description}</small>
        </button>
      ))}
    </div>
  );
  if (isLoading)
    return (
      <Page title="Тренировка слов">
        <p>Загружаем слова…</p>
      </Page>
    );
  if (!words.length)
    return (
      <Page eyebrow="ТРЕНИРОВКА" title="Выберите доступный материал">
        {modeSelector}
        <p className="lead">
          Для этого режима сначала завершите словарную часть хотя бы одного
          урока.
        </p>
        <Link className="button secondary" to="/lessons/greetings">
          Начать первый урок
        </Link>
      </Page>
    );
  if (finished)
    return (
      <Page eyebrow="СЛОВАРНЫЙ ЗАПАС" title="Тренировка завершена">
        {modeSelector}
        <div className="practice result">
          <h2>{points}/100</h2>
          <p>
            {points >= 80
              ? "Отличный результат!"
              : "Повторите слова и попробуйте ещё раз."}
          </p>
          <button className="button secondary" onClick={restart}>
            Новая тренировка
          </button>
          <Link className="button ghost" to="/lessons">
            К урокам
          </Link>
        </div>
      </Page>
    );
  if (!word)
    return (
      <Page title="Тренировка слов">
        <p>Готовим вопросы…</p>
      </Page>
    );
  return (
    <Page
      eyebrow={`${modeLabels[mode].title.toUpperCase()} • 10 ЗАДАНИЙ`}
      title={`Тренируем: ${modeLabels[mode].title.toLowerCase()}`}
    >
      {modeSelector}
      <div className="practice vocabulary-practice">
        <div className="step">
          <span>Задание {position + 1} из 10</span>
          <b>{points} баллов</b>
        </div>
        <div className="bar">
          <i style={{ width: `${position * 10}%` }} />
        </div>
        <p className="meta">{word.lessonTitle}</p>
        <p className="target">{word.ru}</p>
        <p>Произнесите или напишите по-итальянски.</p>
        <div className="row wrap">
          <button
            className={listening ? "mic-button recording" : "mic-button"}
            onClick={listening ? stopVoice : startVoice}
            disabled={Boolean(feedback)}
          >
            <Mic /> {listening ? "Остановить" : "Ответить голосом"}
          </button>
          <button
            className="button ghost"
            onClick={() => speak(word.it, 0.8)}
            disabled={!feedback}
          >
            <Volume2 /> Послушать ответ
          </button>
        </div>
        {voiceStatus && (
          <div className="voice-status" aria-live="polite">
            {voiceStatus}
          </div>
        )}
        <label>
          Ваш ответ
          <input
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && evaluate()}
            disabled={Boolean(feedback)}
          />
        </label>
        {!feedback ? (
          <button
            className="button primary"
            onClick={() => evaluate()}
            disabled={!answer.trim()}
          >
            Проверить
          </button>
        ) : (
          <div
            className={feedback.correct ? "feedback success" : "feedback"}
            aria-live="polite"
          >
            <b>
              {feedback.correct ? "Верно" : `Совпадение ${feedback.score}%`}
            </b>
            <p>
              Правильный ответ: <span lang="it">{word.it}</span>
            </p>
            <small>{feedback.message}</small>
            <button className="button primary listening-next" onClick={next}>
              Следующее задание <ArrowRight />
            </button>
          </div>
        )}
      </div>
    </Page>
  );
}
function Words() {
  const qc = useQueryClient(),
    {
      data = [],
      isLoading,
      isError,
    } = useQuery({
      queryKey: ["words"],
      queryFn: () => api<any[]>(`/api/words/${aid}`),
    }),
    [search, setSearch] = useState(""),
    [custom, setCustom] = useState({ italian: "", translation: "" });
  const add = async () => {
    if (!custom.italian || !custom.translation) return;
    await api("/api/words", {
      method: "POST",
      body: JSON.stringify({ anonymousId: aid, ...custom }),
    });
    setCustom({ italian: "", translation: "" });
    qc.invalidateQueries({ queryKey: ["words"] });
  };
  const remove = async (id: string) => {
    if (confirm("Удалить слово из словаря?")) {
      await api(`/api/words/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["words"] });
    }
  };
  const review = async (id: string, action: string) => {
    await api(`/api/words/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    qc.invalidateQueries({ queryKey: ["words"] });
  };
  const filtered = data.filter((w) =>
    (w.italian + w.translation).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Page eyebrow="ИНТЕРВАЛЬНОЕ ПОВТОРЕНИЕ" title="Мои слова">
      <div className="toolbar">
        <input
          aria-label="Поиск слов"
          placeholder="Найти слово"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>{data.length} слов</span>
      </div>
      <div className="add-word">
        <input
          placeholder="Italiano"
          value={custom.italian}
          onChange={(e) => setCustom({ ...custom, italian: e.target.value })}
        />
        <input
          placeholder="Перевод"
          value={custom.translation}
          onChange={(e) =>
            setCustom({ ...custom, translation: e.target.value })
          }
        />
        <button className="button secondary" onClick={add}>
          <Plus /> Добавить
        </button>
      </div>
      {isLoading ? (
        <p>Загружаем словарь…</p>
      ) : isError ? (
        <p className="feedback">
          Локальный сервер недоступен. Изменения временно сохраняются в
          браузере.
        </p>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <h2>Здесь появятся ваши слова</h2>
          <p>Добавьте их из урока, транскрипта или формы выше.</p>
        </div>
      ) : (
        <div className="word-list">
          {filtered.map((w) => (
            <article key={w.id}>
              <button
                className="icon"
                onClick={() => speak(w.italian)}
                aria-label={`Воспроизвести ${w.italian}`}
              >
                <Volume2 />
              </button>
              <div>
                <h3>{w.italian}</h3>
                <p>{w.translation}</p>
                <small>
                  Следующее повторение:{" "}
                  {new Date(w.nextReviewAt).toLocaleDateString("ru")}
                </small>
              </div>
              <button
                className="button ghost"
                onClick={() => review(w.id, "review")}
              >
                Повторить
              </button>
              <button
                className="button ghost"
                onClick={() => review(w.id, "known")}
              >
                Знаю
              </button>
              <button
                className="icon danger"
                onClick={() => remove(w.id)}
                aria-label={`Удалить ${w.italian}`}
              >
                <Trash2 />
              </button>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}
function Progress() {
  const { data } = useQuery({
    queryKey: ["progress"],
    queryFn: () => api<any>(`/api/progress/${aid}`),
  });
  const done = data?.lessons?.filter((x: any) => x.completed).length || 0,
    attempts = data?.attempts || [];
  return (
    <Page eyebrow="ВАШ ПУТЬ" title="Прогресс">
      <div className="stats large">
        <article>
          <b>{done}</b>
          <span>уроков завершено</span>
        </article>
        <article>
          <b>{attempts.length}</b>
          <span>всего попыток</span>
        </article>
        <article>
          <b>
            {attempts.length
              ? Math.round(
                  attempts.reduce((s: number, x: any) => s + x.score, 0) /
                    attempts.length,
                )
              : 0}
            %
          </b>
          <span>средний результат</span>
        </article>
      </div>
      <h2>Активность за 7 дней</h2>
      <div className="week">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d, i) => (
          <div key={d}>
            <i style={{ height: `${20 + (i % 4) * 18}px` }} />
            <span>{d}</span>
          </div>
        ))}
      </div>
      <h2>Достижения</h2>
      <div className="achievements">
        <article className={done ? "unlocked" : ""}>
          🏅 <b>Первый урок</b>
          <span>{done ? "Получено" : "Завершите первый урок"}</span>
        </article>
        <article>
          💬 <b>Первый диалог</b>
          <span>Проведите диалог</span>
        </article>
        <article>
          📚 <b>Первые 10 слов</b>
          <span>Добавьте 10 слов</span>
        </article>
        <article>
          🔥 <b>3 дня подряд</b>
          <span>Занимайтесь три дня</span>
        </article>
      </div>
    </Page>
  );
}
function ProfileManager() {
  type FamilyProfile = LocalProfile & {
    lastSeenAt?: string | null;
    lastSeenIp?: string | null;
    pinConfigured?: boolean | number;
  };
  const [profiles, setProfiles] = useState<FamilyProfile[]>(readProfiles()),
    [familyCode, setFamilyCode] = useState(""),
    [connectCode, setConnectCode] = useState(""),
    [familyStatus, setFamilyStatus] = useState(""),
    [unlockTarget, setUnlockTarget] = useState<FamilyProfile | null>(null),
    [pin, setPin] = useState(""),
    [pinError, setPinError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const local = readProfiles();
    api<any>(`/api/family/${aid}/attach`, {
      method: "POST",
      body: JSON.stringify({ anonymousIds: local.map((item) => item.id) }),
    })
      .then((response) => {
        const items = response.profiles.map((remote: any) => ({
          ...upsertProfile(remote.anonymousId, {
            name: remote.name || "Ученик",
            onboarded: Boolean(remote.name),
          }),
          lastSeenAt: remote.lastSeenAt,
          lastSeenIp: remote.lastSeenIp,
          pinConfigured: remote.pinConfigured,
        }));
        if (!cancelled) setProfiles(items);
      })
      .catch(() => setFamilyStatus("Не удалось загрузить семейные профили"));
    return () => {
      cancelled = true;
    };
  }, []);
  const openProfile = (selected: FamilyProfile) => {
    activateProfile(selected.id);
    location.href = selected?.onboarded ? "/" : "/onboarding";
  };
  const choose = (profile: FamilyProfile) => {
    if (profile.id !== aid && profile.pinConfigured) {
      setUnlockTarget(profile);
      setPin("");
      setPinError("");
      return;
    }
    openProfile(profile);
  };
  const unlock = async () => {
    if (!unlockTarget || !/^\d{4,8}$/.test(pin)) {
      setPinError("Введите PIN из 4–8 цифр");
      return;
    }
    try {
      await api("/api/profile/unlock", {
        method: "POST",
        body: JSON.stringify({ anonymousId: unlockTarget.id, pin }),
      });
      openProfile(unlockTarget);
    } catch {
      setPinError("Неверный PIN или слишком много попыток");
    }
  };
  const create = async () => {
    if (profiles.length >= 10) return;
    const id = createAnonymousId();
    upsertProfile(id, { name: "Новый пользователь", onboarded: false });
    await api(`/api/family/${aid}/attach`, {
      method: "POST",
      body: JSON.stringify({ anonymousIds: [id] }),
    });
    activateProfile(id);
    location.href = "/onboarding";
  };
  const issueCode = async () => {
    if (
      familyCode &&
      !confirm("Создать новый код? Предыдущий код перестанет работать.")
    )
      return;
    const response = await api<{ code: string }>(`/api/family/${aid}/code`, {
      method: "POST",
    });
    setFamilyCode(response.code);
    setFamilyStatus("Сохраните код или сфотографируйте его");
  };
  const connect = async () => {
    setFamilyStatus("Подключаем семейные профили…");
    try {
      const response = await api<any>("/api/family/connect", {
        method: "POST",
        body: JSON.stringify({ code: connectCode }),
      });
      const connected = response.profiles.map((remote: any) =>
        upsertProfile(remote.anonymousId, {
          name: remote.name || "Ученик",
          onboarded: Boolean(remote.name),
        }),
      );
      const connectedIds = new Set(
        connected.map((item: LocalProfile) => item.id),
      );
      for (const local of readProfiles())
        if (!connectedIds.has(local.id)) removeLocalProfile(local.id);
      activateProfile(connected[0].id);
      location.href = "/profiles";
    } catch {
      setFamilyStatus("Код не найден или временно заблокирован");
    }
  };
  return (
    <Page eyebrow="СЕМЕЙНЫЙ ДОСТУП" title="Кто сегодня занимается?">
      <p className="lead">
        У каждого пользователя отдельные уроки, слова, оценки и тренировки.
      </p>
      <section className="family-connect card">
        <div>
          <h2>Подключение другого компьютера</h2>
          <p>
            Создайте семейный код на этом компьютере или введите ранее
            сохранённый код.
          </p>
        </div>
        <div className="row wrap">
          <button className="button secondary" onClick={issueCode}>
            {familyCode ? "Перевыпустить код" : "Создать семейный код"}
          </button>
          {familyCode && <code className="family-code">{familyCode}</code>}
        </div>
        <div className="family-code-input">
          <input
            aria-label="Семейный код"
            value={connectCode}
            onChange={(event) => setConnectCode(event.target.value)}
            placeholder="ITAL-XXXX-XXXX-XXXX-XXXX"
          />
          <button
            className="button ghost"
            onClick={connect}
            disabled={connectCode.trim().length < 16}
          >
            Подключить существующую семью
          </button>
        </div>
        {familyStatus && (
          <p className="feedback" role="status">
            {familyStatus}
          </p>
        )}
      </section>
      {unlockTarget && (
        <section className="pin-unlock card" aria-live="polite">
          <h2>PIN профиля «{unlockTarget.name}»</h2>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => event.key === "Enter" && unlock()}
            autoFocus
          />
          {pinError && <p className="feedback">{pinError}</p>}
          <div className="row wrap">
            <button className="button primary" onClick={unlock}>
              Открыть
            </button>
            <button
              className="button ghost"
              onClick={() => setUnlockTarget(null)}
            >
              Отмена
            </button>
          </div>
        </section>
      )}
      <div className="profile-grid">
        {profiles.map((profile) => (
          <button
            className={
              profile.id === aid ? "profile-card active" : "profile-card"
            }
            key={profile.id}
            onClick={() => choose(profile)}
          >
            <span className="profile-avatar" aria-hidden="true">
              {(profile.name || "?").charAt(0).toUpperCase()}
            </span>
            <span>
              <b>{profile.name}</b>
              <small>
                {profile.id === aid
                  ? "Используется сейчас"
                  : profile.onboarded
                    ? "Открыть профиль"
                    : "Завершить настройку"}
              </small>
              {profile.lastSeenAt && (
                <small>
                  Последний вход:{" "}
                  {new Date(profile.lastSeenAt).toLocaleString("ru-RU")}
                </small>
              )}
              {profile.pinConfigured ? <small>Защищён PIN</small> : null}
            </span>
          </button>
        ))}
        <button
          className="profile-card add-profile"
          onClick={create}
          disabled={profiles.length >= 10}
        >
          <span className="profile-avatar" aria-hidden="true">
            +
          </span>
          <span>
            <b>Добавить пользователя</b>
            <small>
              {profiles.length >= 10
                ? "Достигнут лимит 10 профилей"
                : "Создать отдельный прогресс"}
            </small>
          </span>
        </button>
      </div>
    </Page>
  );
}
function Settings() {
  const { data: status } = useQuery({
      queryKey: ["status"],
      queryFn: () => api<any>("/api/system/status"),
    }),
    [profile, setProfile] = useState<any>(),
    [pinInput, setPinInput] = useState(""),
    [pinStatus, setPinStatus] = useState("");
  useEffect(() => {
    api<any>(`/api/profile/${aid}`).then(setProfile);
  }, []);
  const save = () =>
    api(`/api/profile/${aid}`, {
      method: "PUT",
      body: JSON.stringify({ ...profile, anonymousId: aid }),
    }).then(() => {
      upsertProfile(aid, { name: profile.name || "Ученик", onboarded: true });
      alert("Настройки сохранены");
    });
  const exportData = () => {
    window.location.href = `/api/export/${aid}`;
  };
  const savePin = async (remove = false) => {
    if (!remove && !/^\d{4,8}$/.test(pinInput)) {
      setPinStatus("PIN должен содержать от 4 до 8 цифр");
      return;
    }
    await api(`/api/profile/${aid}/pin`, {
      method: "PUT",
      body: JSON.stringify({ pin: remove ? "" : pinInput }),
    });
    setPinInput("");
    setPinStatus(remove ? "PIN отключён" : "PIN установлен");
  };
  const importData = async (file: File) => {
    if (!confirm("Импорт объединит данные с текущими. Продолжить?")) return;
    await api(`/api/import/${aid}`, {
      method: "POST",
      body: await file.text(),
    });
    alert("Импорт завершён");
  };
  const remove = async () => {
    if (
      confirm(
        `Удалить профиль «${profile.name || "Пользователь"}» и весь его прогресс? Другие профили останутся.`,
      )
    ) {
      await api(`/api/profile/${aid}`, { method: "DELETE" });
      removeLocalProfile(aid);
      localStorage.removeItem(`italian-sync-queue:${aid}`);
      const remaining = readProfiles();
      if (remaining.length) {
        activateProfile(remaining[0].id);
        location.href = remaining[0].onboarded ? "/" : "/onboarding";
      } else {
        const nextId = createAnonymousId();
        upsertProfile(nextId, {
          name: "Новый пользователь",
          onboarded: false,
        });
        activateProfile(nextId);
        location.href = "/onboarding";
      }
    }
  };
  if (!profile)
    return (
      <Page title="Настройки">
        <p>Загрузка…</p>
      </Page>
    );
  return (
    <Page eyebrow="ЛОКАЛЬНАЯ КОНФИГУРАЦИЯ" title="Настройки">
      <div className="settings-grid">
        <section className="card">
          <h2>Профиль</h2>
          <label>
            Имя
            <input
              value={profile.name || ""}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </label>
          <label>
            Минут в день
            <select
              value={profile.dailyMinutes}
              onChange={(e) =>
                setProfile({ ...profile, dailyMinutes: Number(e.target.value) })
              }
            >
              <option>10</option>
              <option>15</option>
              <option>20</option>
              <option>30</option>
            </select>
          </label>
          <button className="button primary" onClick={save}>
            Сохранить
          </button>
          <Link className="button ghost" to="/profiles">
            Сменить или добавить пользователя
          </Link>
          <h3>PIN при переключении</h3>
          <p>
            Необязательная защита профиля на семейных компьютерах. Отдельно
            сохраните семейный код для восстановления.
          </p>
          <input
            aria-label="Новый PIN профиля"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinInput}
            onChange={(event) =>
              setPinInput(event.target.value.replace(/\D/g, ""))
            }
            placeholder="4–8 цифр"
          />
          <div className="row wrap">
            <button className="button secondary" onClick={() => savePin()}>
              Установить PIN
            </button>
            <button className="button ghost" onClick={() => savePin(true)}>
              Отключить PIN
            </button>
          </div>
          {pinStatus && (
            <p className="feedback" role="status">
              {pinStatus}
            </p>
          )}
        </section>
        <section className="card">
          <h2>Состояние системы</h2>
          <dl>
            <dt>AI</dt>
            <dd>{status?.provider || "Демо AI"}</dd>
            <dt>Модель</dt>
            <dd>{status?.model || "сценарный движок"}</dd>
            <dt>База</dt>
            <dd>SQLite · локальная папка data</dd>
            <dt>Прокси</dt>
            <dd>{status?.proxyConfigured ? "настроен" : "не используется"}</dd>
          </dl>
          {location.hostname !== "localhost" &&
            location.hostname !== "127.0.0.1" && (
              <p className="warning">
                Приложение доступно другим устройствам в вашей локальной сети.
                Не включайте этот режим в недоверенной сети.
              </p>
            )}
        </section>
        <section className="card">
          <h2>Перенос данных</h2>
          <button className="button secondary" onClick={exportData}>
            Экспорт прогресса
          </button>
          <label className="button ghost">
            Импорт JSON
            <input
              className="sr-only"
              type="file"
              accept="application/json"
              onChange={(e) =>
                e.target.files?.[0] && importData(e.target.files[0])
              }
            />
          </label>
        </section>
        <section className="card danger-zone">
          <h2>Удаление</h2>
          <p>Аудиозаписи никогда не сохраняются.</p>
          <button className="button danger" onClick={remove}>
            <Trash2 /> Удалить мои данные
          </button>
        </section>
      </div>
    </Page>
  );
}
function Privacy() {
  return (
    <Page eyebrow="ПРИВАТНОСТЬ" title="Ваш голос не записывается">
      <div className="prose">
        <p>
          Микрофон используется только для распознавания текущей попытки.
          Приложение не сохраняет Blob, MediaStream, WAV, MP3 или другие
          аудиоданные.
        </p>
        <p>
          В демо-режиме учебные данные остаются на этом компьютере. При
          включённом OpenRouter текст сообщения AI-репетитору передаётся
          внешнему провайдеру; аудио туда не отправляется.
        </p>
        <p>
          Browser Speech Recognition может использовать сервис браузера. Если
          это нежелательно, выберите текстовый режим.
        </p>
      </div>
    </Page>
  );
}
function NotFound() {
  return (
    <Page title="Страница не найдена">
      <p>Такого учебного маршрута пока нет.</p>
      <Link className="button primary" to="/">
        Вернуться на главную
      </Link>
    </Page>
  );
}
export function App() {
  useEffect(() => {
    flushQueue();
  }, []);
  const onboarded = isProfileOnboarded(aid);
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/control" element={<ControlPage />} />
      <Route path="/join-family" element={<JoinFamily />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<Layout />}>
        <Route index element={onboarded ? <Home /> : <Onboarding />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="lessons/:lessonId" element={<LessonAccess><Lesson /></LessonAccess>} />
        <Route path="lessons/:lessonId/listening" element={<LessonAccess><Listening /></LessonAccess>} />
        <Route
          path="lessons/:lessonId/pronunciation"
          element={<LessonAccess><Pronunciation /></LessonAccess>}
        />
        <Route path="lessons/:lessonId/quiz" element={<LessonAccess><Quiz /></LessonAccess>} />
        <Route path="exam" element={<MiniExam />} />
        <Route path="tutor" element={<Tutor />} />
        <Route path="training" element={<VocabularyTraining />} />
        <Route path="words" element={<Words />} />
        <Route path="progress" element={<Progress />} />
        <Route path="profiles" element={<ProfileManager />} />
        <Route path="family" element={<FamilyAdmin />} />
        <Route path="settings" element={<Settings />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

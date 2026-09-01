import { createContext, FormEvent, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, Outlet, useNavigate, useParams } from "react-router-dom";
import { ProgramsPage } from "./ProgramsPage";
import { familyRoleLabel } from "../family-role-labels";

export type InternetMe = { user_id: string; display_name: string; email: string; familyId: string | null; familyRole: string | null };
export type Enrollment = { course_key: string; course_name: string; language_key: string; language_name: string; status: string };
type Context = { me: InternetMe; enrollments: Enrollment[]; activeCourse: Enrollment | null };
const InternetContext = createContext<Context | null>(null);

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  if (!response.ok) throw Object.assign(new Error("REQUEST_FAILED"), { status: response.status });
  return response.json();
}
async function loadMe() {
  try { return await json<InternetMe>("/api/v1/auth/me"); }
  catch (error) {
    if ((error as { status?: number }).status !== 401) throw error;
    const refreshed = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!refreshed.ok) throw error;
    return json<InternetMe>("/api/v1/auth/me");
  }
}

export function InternetGate() {
  const me = useQuery({ queryKey: ["internet-me"], queryFn: loadMe, retry: false });
  const enrollments = useQuery({ queryKey: ["internet-enrollments"], queryFn: () => json<{ enrollments: Enrollment[] }>("/api/v1/learning/enrollments"), enabled: Boolean(me.data), retry: false });
  if (me.isLoading || (me.data && enrollments.isLoading)) return <main className="auth-page"><section className="auth-card"><h1>LangTutor</h1><p role="status">Загружаем ваш аккаунт…</p></section></main>;
  if (!me.data) return <Navigate to="/auth" replace />;
  const items = enrollments.data?.enrollments ?? [];
  return <InternetContext.Provider value={{ me: me.data, enrollments: items, activeCourse: items[0] ?? null }}><Outlet /></InternetContext.Provider>;
}
export function useInternetAccount() { const value = useContext(InternetContext); if (!value) throw new Error("Internet account context is missing"); return value; }

export function InternetHomePage() {
  const { me, enrollments } = useInternetAccount();
  if (!enrollments.length) return <section className="page"><p className="eyebrow">ДОБРО ПОЖАЛОВАТЬ, {me.display_name}</p><h1>Что вы хотите изучать?</h1><p className="lead">Сначала выберите программу. После выбора LangTutor предложит цели и темп именно для этого языка.</p><ProgramsPage /></section>;
  return <section className="page"><p className="eyebrow">ВАШИ ПРОГРАММЫ</p><h1>Продолжить обучение</h1><div className="program-grid">{enrollments.map(item => <article key={item.course_key}><p>{item.language_name}</p><h2>{item.course_name}</h2><Link className="button primary" to={`/programs/${item.course_key}`}>Открыть уроки</Link></article>)}</div><p><Link to="/programs">Добавить другую программу</Link></p></section>;
}

export function ProgramOnboarding() {
  const { courseKey = "" } = useParams(), navigate = useNavigate(), client = useQueryClient();
  const [goal, setGoal] = useState("travel"), [minutes, setMinutes] = useState(15), [level, setLevel] = useState("zero"), [status, setStatus] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setStatus("Сохраняем персональный план…"); try { await json("/api/v1/learning/enrollments", { method: "POST", body: JSON.stringify({ courseKey }) }); await json("/api/v1/learning/settings", { method: "PUT", body: JSON.stringify({ [`course:${courseKey}`]: { goal, dailyMinutes: minutes, initialLevel: level } }) }); await client.invalidateQueries({ queryKey: ["internet-enrollments"] }); navigate(`/programs/${courseKey}`, { replace: true }); } catch { setStatus("Не удалось сохранить план. Повторите попытку."); } }
  return <section className="page"><p className="eyebrow">ПЕРСОНАЛЬНЫЙ ПЛАН</p><h1>Настроим выбранную программу</h1><form className="card onboarding-form" onSubmit={submit}><label>Цель<select value={goal} onChange={e=>setGoal(e.target.value)}><option value="travel">Путешествия</option><option value="communication">Общение</option><option value="work">Работа</option><option value="self">Для себя</option></select></label><label>Минут в день<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option><option value={30}>30</option></select></label><label>Начальный уровень<select value={level} onChange={e=>setLevel(e.target.value)}><option value="zero">С нуля</option><option value="words">Знаю отдельные слова</option><option value="previous">Учил раньше</option></select></label><button className="button primary">Начать программу</button><p role="status">{status}</p></form></section>;
}

export function InternetAccountPage() {
  const { me } = useInternetAccount(), navigate = useNavigate(), client = useQueryClient();
  async function logout() { await fetch("/api/v1/auth/logout-all", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }); client.clear(); navigate("/auth", { replace: true }); }
  return <section className="page"><p className="eyebrow">ИНТЕРНЕТ-АККАУНТ</p><h1>{me.display_name}</h1><div className="card"><p>{me.email}</p><p>{me.familyId ? `Семья подключена · роль: ${familyRoleLabel(me.familyRole)}` : "Семья пока не подключена"}</p><Link className="button secondary" to="/family">Управление семьёй</Link><button className="button ghost" onClick={logout}>Выйти</button></div><p>Локальные профили «Ученик» не используются в интернет-версии.</p></section>;
}

export function InternetProgressPage() {
  const { enrollments } = useInternetAccount();
  const progress = useQuery({ queryKey: ["internet-progress"], queryFn: () => json<{ lessons: Array<{ lesson_key: string; completion_percent: number; completed: boolean; score: number | null }> }>("/api/v1/learning/progress") });
  return <section className="page"><h1>Прогресс</h1>{progress.isLoading ? <p role="status">Загрузка…</p> : <><p>Активных программ: {enrollments.length}</p><div className="word-list">{(progress.data?.lessons ?? []).map(item => <div key={item.lesson_key}><b>{item.lesson_key}</b><span>{item.completed ? "Завершён" : `${item.completion_percent}%`}</span>{item.score != null && <small>Оценка: {item.score}</small>}</div>)}</div></>}</section>;
}

export function ActiveCourseRedirect() { const { activeCourse } = useInternetAccount(); return <Navigate to={activeCourse ? `/programs/${activeCourse.course_key}` : "/programs"} replace />; }

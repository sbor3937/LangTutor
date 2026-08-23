import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

type Family = { id: string; name: string; role: string; members: Array<{ user_id: string; role: string }> };

async function familyApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/families${path}`, { credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Не удалось выполнить действие");
  return body;
}

export function FamilyAdmin() {
  const [family, setFamily] = useState<Family | null>(null), [name, setName] = useState(""), [email, setEmail] = useState(""), [inviteUrl, setInviteUrl] = useState(""), [status, setStatus] = useState(""), [loading, setLoading] = useState(true);
  async function load() { try { setFamily(await familyApi<Family>("/current")); } catch { setFamily(null); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function create(event: FormEvent) { event.preventDefault(); setStatus(""); try { await familyApi("/", { method: "POST", body: JSON.stringify({ name }) }); await load(); } catch (error) { setStatus(error instanceof Error ? error.message : "Ошибка"); } }
  async function invite(event: FormEvent) { event.preventDefault(); setStatus(""); try { const result = await familyApi<{ inviteUrl: string }>("/current/invitations", { method: "POST", body: JSON.stringify({ email, role: "member" }) }); setInviteUrl(result.inviteUrl); setStatus("Приглашение создано. Передайте ссылку адресату безопасным способом."); } catch (error) { setStatus(error instanceof Error ? error.message : "Ошибка"); } }
  if (loading) return <section className="page"><h1>Семья</h1><p role="status">Загрузка…</p></section>;
  return <section className="page"><h1>Семья</h1>{!family ? <form className="card" onSubmit={create}><h2>Создать семейное пространство</h2><label>Название<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label><button className="primary">Создать семью</button></form> : <><div className="card"><h2>{family.name}</h2><p>Ваша роль: {family.role}</p><p>Участников: {family.members.length}</p></div>{["owner","admin"].includes(family.role) && <form className="card" onSubmit={invite}><h2>Пригласить участника</h2><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="primary">Создать приглашение</button>{inviteUrl && <label>Одноразовая ссылка<input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} /></label>}</form>}</>}<p role="status" aria-live="polite">{status}</p></section>;
}

export function JoinFamily() {
  const [params] = useSearchParams(), navigate = useNavigate(), [password, setPassword] = useState(""), [status, setStatus] = useState("");
  const token = params.get("token") || "";
  async function accept(event: FormEvent) { event.preventDefault(); try { await familyApi("/invitations/accept", { method: "POST", body: JSON.stringify({ token, password }) }); setStatus("Переход выполнен. Учебный прогресс сохранён."); setTimeout(() => navigate("/family"), 800); } catch (error) { setStatus(error instanceof Error ? error.message : "Ошибка"); } }
  return <main className="auth-page"><section className="auth-card"><Link className="brand" to="/">LangTutor</Link><h1>Вступление в семью</h1>{token ? <form onSubmit={accept}><p>Для подтверждения перехода повторно введите пароль.</p><label>Пароль<input type="password" autoComplete="current-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="primary">Принять приглашение</button></form> : <p>В ссылке отсутствует токен приглашения.</p>}<p role="status" aria-live="polite">{status}</p></section></main>;
}

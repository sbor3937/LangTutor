import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

async function post(path: string, body: unknown) {
  const response = await fetch(`/api/v1/auth/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Ссылка недействительна или устарела.");
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("Подтверждаем адрес…");
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("В ссылке отсутствует токен подтверждения."); return; }
    post("verify-email", { token })
      .then(() => { setVerified(true); setStatus("Email подтверждён. Теперь можно войти в LangTutor."); })
      .catch((error: Error) => setStatus(error.message));
  }, [params]);
  return <main className="auth-page"><section className="auth-card" aria-labelledby="verify-title"><Link to="/" className="brand">LangTutor</Link><h1 id="verify-title">Подтверждение email</h1><p role="status" aria-live="polite">{status}</p><Link className="primary" to="/auth">{verified ? "Войти" : "Перейти к авторизации"}</Link></section></main>;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);
  const token = params.get("token");
  async function submit(event: FormEvent) {
    event.preventDefault(); setStatus("Сохраняем новый пароль…");
    if (!token) { setStatus("В ссылке отсутствует токен восстановления."); return; }
    try { await post("reset-password", { token, password }); setDone(true); setStatus("Пароль изменён. Теперь можно войти."); }
    catch (error) { setStatus((error as Error).message); }
  }
  return <main className="auth-page"><section className="auth-card" aria-labelledby="reset-title"><Link to="/" className="brand">LangTutor</Link><h1 id="reset-title">Новый пароль</h1>{done ? <><p role="status">{status}</p><Link className="primary" to="/auth">Войти</Link></> : <form aria-label="Форма смены пароля" onSubmit={submit}><label>Новый пароль<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><p className="hint">Минимум 12 символов.</p><button className="primary" type="submit">Изменить пароль</button><p className="form-status" role="status" aria-live="polite">{status}</p></form>}</section></main>;
}

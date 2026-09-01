import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type Mode = "login" | "register" | "recover";

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const endpoint = mode === "recover" ? "request-password-reset" : mode;
      const response = await fetch(`/api/v1/auth/${endpoint}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { email, password, displayName } : mode === "recover" ? { email } : { email, password }),
      });
      if (!response.ok) {
        setStatus(response.status === 401 ? "Не удалось войти. Проверьте email, пароль и подтверждение почты." : "Не удалось выполнить действие. Проверьте данные и повторите.");
        return;
      }
      if (mode === "register") setStatus("Аккаунт создан. Проверьте почту и подтвердите адрес.");
      else if (mode === "recover") setStatus("Если аккаунт существует, письмо для смены пароля уже отправлено.");
      else navigate("/");
    } catch {
      setStatus("Сервис временно недоступен. Попробуйте позднее.");
    } finally { setBusy(false); }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link to="/" className="brand">LangTutor</Link>
        <h1 id="auth-title">{mode === "login" ? "Вход" : mode === "register" ? "Создание аккаунта" : "Восстановление пароля"}</h1>
        <div className="auth-tabs" role="group" aria-label="Режим авторизации">
          <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>Вход</button>
          <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")}>Регистрация</button>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && <label>Имя<input autoComplete="name" maxLength={80} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>}
          <label>Email<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {mode !== "recover" && <label>Пароль<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
          {mode !== "recover" && <p className="hint">Минимум 12 символов. Не используйте пароль от другого сервиса.</p>}
          <button className="primary" disabled={busy} type="submit">{busy ? "Подождите…" : mode === "login" ? "Войти" : mode === "register" ? "Создать аккаунт" : "Получить письмо"}</button>
          {mode === "login" && <button className="button-link" type="button" onClick={() => { setMode("recover"); setStatus(""); }}>Забыли пароль?</button>}
          {mode === "recover" && <button className="button-link" type="button" onClick={() => { setMode("login"); setStatus(""); }}>Вернуться ко входу</button>}
          <p className="form-status" role="status" aria-live="polite">{status}</p>
        </form>
      </section>
    </main>
  );
}

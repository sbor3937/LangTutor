let refreshing: Promise<boolean> | null = null;
let generation = 0;
async function refreshSession() {
  if (!refreshing) refreshing = fetch("/api/v1/auth/refresh", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
  }).then(response => { if (response.ok) generation++; return response.ok; }).finally(() => { refreshing = null; });
  return refreshing;
}
/** Retry only an explicit authentication failure, never a timeout or a failed mutation. */
export async function internetFetch(path: string, init?: RequestInit): Promise<Response> {
  const started = generation;
  const options = { ...init, credentials: "include" as const };
  const response = await fetch(path, options);
  if (response.status !== 401) return response;
  if (generation !== started || await refreshSession()) return fetch(path, options);
  throw new Error("Сессия завершена. Войдите снова через «Аккаунт». Ваш текущий ответ оставлен на странице.");
}

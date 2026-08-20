export function createAnonymousId() {
  if (typeof globalThis.crypto?.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(bytes);
  else
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function anonymousId() {
  let id = localStorage.getItem("italian-anonymous-id");
  if (!id) {
    id = createAnonymousId();
    localStorage.setItem("italian-anonymous-id", id);
  }
  return id;
}
function queueKey() {
  return `italian-sync-queue:${anonymousId()}`;
}
function readQueue() {
  const key = queueKey();
  if (
    !localStorage.getItem(key) &&
    localStorage.getItem("italian-sync-queue")
  ) {
    localStorage.setItem(
      key,
      localStorage.getItem("italian-sync-queue") || "[]",
    );
    localStorage.removeItem("italian-sync-queue");
  }
  return JSON.parse(localStorage.getItem(key) || "[]") as {
    url: string;
    options: RequestInit;
    at?: string;
  }[];
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!response.ok) {
      const error = new Error("request") as Error & { status: number };
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? (undefined as T) : response.json();
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (
      options?.method &&
      options.method !== "GET" &&
      (!status || status >= 500)
    ) {
      const queue = readQueue();
      queue.push({ url, options, at: new Date().toISOString() });
      localStorage.setItem(queueKey(), JSON.stringify(queue.slice(-100)));
    }
    throw error;
  }
}
export async function flushQueue() {
  const queue = readQueue();
  const pending = [];
  for (const item of queue) {
    try {
      const r = await fetch(item.url, item.options);
      if (!r.ok && r.status >= 500) pending.push(item);
    } catch {
      pending.push(item);
    }
  }
  localStorage.setItem(queueKey(), JSON.stringify(pending));
}

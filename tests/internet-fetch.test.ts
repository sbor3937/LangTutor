import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
it("refreshes an expired session and retries the same mutation exactly once", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response("{}")).mockResolvedValueOnce(new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const { internetFetch } = await import("../client/src/lib/internet-fetch");
  const init = { method: "POST", body: '{"answer":"Ciao"}' };
  expect((await internetFetch("/api/v1/learning/attempts", init)).status).toBe(201);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[1][0]).toBe("/api/v1/auth/refresh");
  expect(fetcher.mock.calls[2]).toEqual(fetcher.mock.calls[0]);
});
it("shares a single refresh between concurrent failed requests", async () => {
  let renewed = false;
  const fetcher = vi.fn(async (path: string) => {
    if (path.endsWith("/refresh")) { await Promise.resolve(); renewed = true; return new Response("{}"); }
    return new Response("{}", { status: renewed ? 200 : 401 });
  });
  vi.stubGlobal("fetch", fetcher);
  const { internetFetch } = await import("../client/src/lib/internet-fetch");
  await Promise.all([internetFetch("/api/v1/learning/progress"), internetFetch("/api/v1/learning/enrollments")]);
  expect(fetcher.mock.calls.filter(([path]) => path.endsWith("/refresh"))).toHaveLength(1);
});
it("does not loop when refresh fails", async () => {
  const fetcher = vi.fn(async () => new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetcher);
  const { internetFetch } = await import("../client/src/lib/internet-fetch");
  await expect(internetFetch("/api/v1/learning/progress")).rejects.toThrow("Войдите снова");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("does not replay server errors or network failures that might have already saved data", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 500 })).mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetcher);
  const { internetFetch } = await import("../client/src/lib/internet-fetch");
  expect((await internetFetch("/api/v1/learning/progress", { method: "PUT" })).status).toBe(500);
  await expect(internetFetch("/api/v1/learning/progress", { method: "PUT" })).rejects.toThrow("offline");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

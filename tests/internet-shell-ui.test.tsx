import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InternetGate, InternetHomePage } from "../client/src/components/InternetApp";

describe("internet-first shell", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("redirects an anonymous visitor to authorization", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/"]}><Routes><Route path="/auth" element={<h1>Вход</h1>} /><Route element={<InternetGate />}><Route index element={<InternetHomePage />} /></Route></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });
  it("shows account programs instead of a local learner profile", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/me") ? new Response(JSON.stringify({ user_id: "u", display_name: "София", email: "sofia@sbortech.online", familyId: "f", familyRole: "member" }), { status: 200 }) : new Response(JSON.stringify({ enrollments: [{ course_key: "italian-a0-a1", course_name: "Итальянский A0–A1", language_key: "it", language_name: "Итальянский", status: "active" }] }), { status: 200 })));
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Routes><Route element={<InternetGate />}><Route index element={<InternetHomePage />} /></Route></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Продолжить обучение" })).toBeInTheDocument();
    expect(screen.getByText("Итальянский A0–A1")).toBeInTheDocument();
    expect(screen.queryByText("Выбрать пользователя")).not.toBeInTheDocument();
  });
});

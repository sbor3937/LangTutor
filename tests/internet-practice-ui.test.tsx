import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InternetGate } from "../client/src/components/InternetApp";
import { InternetTrainingPage, InternetTutorPage } from "../client/src/components/InternetPractice";

const account = { user_id: "u", display_name: "София", email: "sofia@sbortech.online", familyId: "f", familyRole: "member" };
const enrollment = { course_key: "italian-a0-a1", course_name: "Итальянский A0–A1", language_key: "it", language_name: "Итальянский", status: "active" };

function renderRoute(path: string, element: React.ReactNode) {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[path]}><Routes><Route element={<InternetGate />}><Route path={path.slice(1)} element={element} /></Route></Routes></MemoryRouter></QueryClientProvider>);
}

describe("internet practice routes", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("opens training without redirecting back to programs", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/auth/me")) return new Response(JSON.stringify(account), { status: 200 });
      if (url.endsWith("/enrollments")) return new Response(JSON.stringify({ enrollments: [enrollment] }), { status: 200 });
      if (url.endsWith("/courses/italian-a0-a1")) return new Response(JSON.stringify({ key: enrollment.course_key, name: enrollment.course_name, language_name: enrollment.language_name, course_version_id: "v1", lessons: [] }), { status: 200 });
      if (url.endsWith("/progress")) return new Response(JSON.stringify({ lessons: [] }), { status: 200 });
      return new Response("{}", { status: 404 });
    }));
    renderRoute("/training", <InternetTrainingPage />);
    expect(await screen.findByRole("heading", { name: "Тренировка" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Перейти к урокам" })).toHaveAttribute("href", "/programs/italian-a0-a1");
  });

  it("opens the Italian tutor composer", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/auth/me")
      ? new Response(JSON.stringify(account), { status: 200 })
      : new Response(JSON.stringify({ enrollments: [enrollment] }), { status: 200 })));
    renderRoute("/tutor", <InternetTutorPage />);
    expect(await screen.findByRole("heading", { name: "AI-репетитор" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Ваш ответ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ответить голосом" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Отправить" })).toBeEnabled();
  });
});

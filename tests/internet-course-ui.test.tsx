import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InternetCoursePage } from "../client/src/components/InternetCoursePage";

describe("InternetCoursePage", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("submits a scored answer and persists completed progress", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/courses/italian-a0-a1")) return new Response(JSON.stringify({ key: "italian-a0-a1", name: "Итальянский A0–A1", language_name: "Итальянский", course_version_id: "version-1", lessons: [{ lesson_key: "greetings", title: "Приветствие", position: 1, content: { goal: "Поздороваться", minutes: 15, explanation: "Ciao — приветствие.", words: [{ target: "Ciao", source: "Привет", example: "Ciao, Marco!", hint: "Чао" }] } }] }), { status: 200 });
      if (url.endsWith("/progress") && init?.method === "PUT") return new Response(JSON.stringify({ lesson_key: "greetings", completed: true, version: 1 }), { status: 200 });
      if (url.endsWith("/progress")) return new Response(JSON.stringify({ lessons: [] }), { status: 200 });
      if (url.endsWith("/attempts")) return new Response(JSON.stringify({ score: 100, correct: true, feedback: "Верно" }), { status: 201 });
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/programs/italian-a0-a1"]}><Routes><Route path="/programs/:courseKey" element={<InternetCoursePage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Итальянский A0–A1" })).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Проверка знания" });
    fireEvent.change(within(form).getByPlaceholderText("Ответ на изучаемом языке"), { target: { value: "Ciao" } });
    fireEvent.click(within(form).getByRole("button", { name: "Проверить ответ" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("100 из 100"));
    fireEvent.click(screen.getByRole("button", { name: "Завершить урок" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Прогресс сохранён"));
    const attemptCall = fetcher.mock.calls.find(([url]) => String(url).endsWith("/attempts"));
    expect(JSON.parse(attemptCall?.[1]?.body as string)).toMatchObject({ courseKey: "italian-a0-a1", lessonKey: "greetings", exerciseKey: "word-1", answer: "Ciao" });
  });
});

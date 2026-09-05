import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InternetCoursePage, InternetLessonPage } from "../client/src/components/InternetCoursePage";

const course = { key: "italian-a0-a1", name: "Итальянский A0–A1", language_name: "Итальянский", language_key: "it", metadata: { targetLocale: "it-IT" }, course_version_id: "version-1", lessons: [{ lesson_key: "greetings", title: "Приветствие", position: 1, content: { goal: "Поздороваться", minutes: 15, explanation: "Ciao — приветствие.", practices: ["Карточки", "Аудирование", "Произношение", "Проверка"], words: [{ target: "Ciao", source: "Привет", example: "Ciao, Marco!", hint: "Чао" }, { target: "Grazie", source: "Спасибо", example: "Grazie!", hint: "Грацие" }, { target: "Prego", source: "Пожалуйста", example: "Prego!", hint: "Прего" }, { target: "Buongiorno", source: "Добрый день", example: "Buongiorno!", hint: "Буонджорно" }, { target: "Arrivederci", source: "До свидания", example: "Arrivederci!", hint: "Арриведерчи" }] } }] };

function fetcher(url: string, init?: RequestInit) {
  if (url.endsWith("/courses/italian-a0-a1")) return Promise.resolve(new Response(JSON.stringify(course), { status: 200 }));
  if (url.endsWith("/progress") && init?.method === "PUT") return Promise.resolve(new Response(JSON.stringify({ lesson_key: "greetings", current_step: 1, completion_percent: 20, completed: false, version: 1 }), { status: 200 }));
  if (url.endsWith("/progress")) return Promise.resolve(new Response(JSON.stringify({ lessons: [] }), { status: 200 }));
  if (url.endsWith("/attempts")) { const answer = JSON.parse(String(init?.body)).answer; const correct = answer === "Ciao"; return Promise.resolve(new Response(JSON.stringify({ score: correct ? 100 : 0, correct, feedback: correct ? "Верно" : "Повторите слово" }), { status: 201 })); }
  if (url.endsWith("/vocabulary")) return Promise.resolve(new Response(JSON.stringify({ id: "word" }), { status: 201 }));
  return Promise.resolve(new Response("{}", { status: 404 }));
}

describe("internet lesson journey", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("shows the full lesson plan instead of a one-word workspace", async () => {
    vi.stubGlobal("fetch", vi.fn(fetcher));
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/programs/italian-a0-a1"]}><Routes><Route path="/programs/:courseKey" element={<InternetCoursePage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Итальянский A0–A1" })).toBeInTheDocument();
    expect(screen.getByText("Каждый урок: карточки и объяснение, аудирование, произношение и итоговая проверка.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Начать/ })).toHaveAttribute("href", "/programs/italian-a0-a1/lessons/greetings");
  });
  it("opens cards, listening, pronunciation and final check under the internet account", async () => {
    const mockedFetch = vi.fn(fetcher);
    vi.stubGlobal("fetch", mockedFetch);
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/programs/italian-a0-a1/lessons/greetings"]}><Routes><Route path="/programs/:courseKey/lessons/:lessonKey" element={<InternetLessonPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Приветствие" })).toBeInTheDocument();
    expect(screen.getByText("Ciao")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Аудирование/ })[0]);
    expect(screen.getByRole("heading", { name: "Слушаем: Приветствие" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Arrivederci"));
    fireEvent.click(screen.getByLabelText("Ciao"));
    expect(mockedFetch.mock.calls.filter(([url]) => String(url).endsWith("/attempts"))).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Проверить ответ" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Верно"));
    fireEvent.click(screen.getByRole("button", { name: "Произношение" }));
    expect(screen.getByRole("heading", { name: "Говорим: Приветствие" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Проверка" }));
    expect(screen.getByText("Вопрос 1 из 5")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ciao" } });
    fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("100 из 100"));
  });
});

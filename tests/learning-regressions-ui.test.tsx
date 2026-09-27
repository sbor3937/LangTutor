import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InternetLessonPage } from "../client/src/components/InternetCoursePage";
import { InternetTrainingPage } from "../client/src/components/InternetPractice";
import { InternetGate } from "../client/src/components/InternetApp";
import { BrowserSpeechRecognitionProvider } from "../client/src/lib/speech";
import { contentPacks } from "../content/registry";
import { scoreAnswer } from "../shared/answer-scoring";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); });
function lessonView() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={["/programs/english-phrasal-verbs-a2-b1/lessons/communication"]}><Routes><Route path="/programs/:courseKey/lessons/:lessonKey" element={<InternetLessonPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}
it("shows the example translation and card-specific checked missions, refreshing session on Know", async () => {
  const pack = contentPacks.find(p => p.courseKey === "english-phrasal-verbs-a2-b1")!;
  const lesson = pack.lessons.find(l => l.id === "communication")!;
  let writes = 0;
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.includes("/courses/")) return new Response(JSON.stringify({ key: pack.courseKey, name: pack.courseName, language_key: "en", language_name: "Английский", course_version_id: "v", metadata: { targetLocale: "en-GB" }, lessons: [{ lesson_key: lesson.id, title: lesson.title, position: 2, content: lesson }] }));
    if (path.endsWith("/refresh")) return new Response("{}");
    if (path.endsWith("/progress") && init?.method === "PUT") return ++writes === 1 ? new Response("{}", { status: 401 }) : new Response(JSON.stringify({ version: 2 }));
    return new Response(JSON.stringify({ lessons: [{ course_version_id: "v", lesson_key: lesson.id, current_step: 3, version: 1, completed: false }] }));
  });
  vi.stubGlobal("fetch", fetcher);
  lessonView();
  await screen.findByRole("heading", { name: "point out" });
  fireEvent.click(screen.getByRole("button", { name: "Показать перевод" }));
  expect(screen.getByText("Она указала на ошибку.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /You notice a mistake/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Проверить ответ" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Can I point out a mistake?" } });
  expect(screen.getByRole("button", { name: "Проверить ответ" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Знаю" }));
  await screen.findByRole("heading", { name: "bring up" });
  expect(screen.queryByRole("heading", { name: /You notice a mistake/ })).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("");
  expect(writes).toBe(2);
  expect(fetcher.mock.calls.filter(([path]) => path.endsWith("/refresh"))).toHaveLength(1);
});
it.each([["it", "Ciao", "it-IT"], ["en", "Hello", "en-GB"]])("keeps the %s training grade visible after voice recognition", async (language, answer, locale) => {
  const enrollment = { course_key: "course", language_key: language, language_name: language, status: "active" };
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith("/auth/me")) return new Response(JSON.stringify({ user_id: "u", display_name: "Learner" }));
    if (path.endsWith("/enrollments")) return new Response(JSON.stringify({ enrollments: [enrollment] }));
    if (path.includes("/courses/")) return new Response(JSON.stringify({ course_version_id: "v", metadata: { targetLocale: locale }, lessons: [{ lesson_key: "greeting", title: "Приветствие", content: { words: [{ target: answer, source: "Привет" }] } }] }));
    if (path.endsWith("/progress")) return new Response(JSON.stringify({ lessons: [{ course_version_id: "v", lesson_key: "greeting", completion_percent: 30 }] }));
    if (path.endsWith("/attempts")) return new Response(JSON.stringify(scoreAnswer(answer, JSON.parse(String(init?.body)).answer, language)));
    return new Response("{}", { status: 404 });
  }));
  vi.spyOn(BrowserSpeechRecognitionProvider.prototype, "isAvailable").mockReturnValue(true);
  const start = vi.spyOn(BrowserSpeechRecognitionProvider.prototype, "start").mockImplementation(async options => { options?.onFinal?.(answer); options?.onEnd?.(answer); });
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/training"]}><Routes><Route element={<InternetGate />}><Route path="/training" element={<InternetTrainingPage />} /></Route></Routes></MemoryRouter></QueryClientProvider>);
  const mic = await screen.findByRole("button", { name: "Ответить голосом" });
  await act(async () => { fireEvent.click(mic); });
  expect(screen.getByRole("textbox")).toHaveValue(answer);
  expect(start.mock.calls[0][0]?.lang).toBe(locale);
  fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
  await waitFor(() => expect(screen.getByText("Верно. Результат: 100 из 100.")).toBeInTheDocument());
  expect(screen.getByText("Ответ распознан.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Следующее задание" })).toBeEnabled();
});

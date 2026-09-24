import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConversationPractice } from "../client/src/components/ConversationPractice";
import { DemoTutorProvider } from "../server/ai/providers/demo";
import { OpenRouterTutorProvider } from "../server/ai/providers/openrouter";

vi.mock("../client/src/components/LessonVoiceInput", () => ({
  LessonVoiceInput: ({ onTranscript }: { onTranscript: (text: string) => void }) =>
    <button onClick={() => onTranscript("I wake up at ten.")}>Завершить распознавание</button>,
}));

const prompts = [{ question: "When do you wake up?", modelAnswer: "I wake up at seven.", tip: "Назовите время." }, { question: "When do you get up?", modelAnswer: "I get up at eight.", tip: "Назовите время." }];
const answer = "I wake up at nine.";
const payload = { replyItalian: "Good!", replyRussian: "Хорошо!", original: answer, corrected: answer, explanationRu: "Ответ верный: время может отличаться от образца.", naturalVariant: null, nextQuestion: "When do you get up?", scenario: "intro", level: "A1", mode: "live" };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("sends the learner's answer and actual question, renders feedback and resets it on edit", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(payload)));
  vi.stubGlobal("fetch", fetcher);
  render(<ConversationPractice prompts={prompts} locale="en-GB" enableCheck />);
  expect(screen.getByRole("button", { name: "Проверить ответ" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: answer } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить ответ" }));
  expect(await screen.findByText(payload.explanationRu)).toBeInTheDocument();
  const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1];
  expect(JSON.parse(init.body as string)).toMatchObject({ language: "en", message: answer, question: prompts[0].question });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Another answer" } });
  expect(screen.queryByText(payload.explanationRu)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Другой вопрос" }));
  expect(screen.getByRole("textbox")).toHaveValue("");
});
it("shows errors without losing the answer and permits retry; demo is not a successful assessment", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Лимит ИИ исчерпан" } }), { status: 429 })).mockResolvedValueOnce(new Response(JSON.stringify({ ...payload, mode: "fallback" }))));
  render(<ConversationPractice prompts={prompts} locale="en-GB" enableCheck />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: answer } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить ответ" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Лимит ИИ исчерпан");
  expect(screen.getByRole("textbox")).toHaveValue(answer);
  fireEvent.click(screen.getByRole("button", { name: "Проверить ответ" }));
  expect(await screen.findByText("Деморежим — ответ не проверен ИИ")).toBeInTheDocument();
  expect(screen.queryByText(payload.explanationRu)).not.toBeInTheDocument();
});
it("blocks duplicate checks while a request is pending", async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal("fetch", fetcher);
  render(<ConversationPractice prompts={prompts} locale="en-GB" enableCheck />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: answer } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить ответ" }));
  expect(screen.getByRole("button", { name: "Проверяем…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Другой вопрос" })).toBeDisabled();
  resolve(new Response(JSON.stringify(payload)));
  await waitFor(() => expect(screen.getByText(payload.explanationRu)).toBeInTheDocument());
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("keeps English demo output English and makes no correctness claim", async () => {
  const result = await new DemoTutorProvider().complete({ language: "en", message: answer, question: prompts[0].question, scenario: "intro", history: [], unlockedLessonIds: [], model: "demo", maxOutputTokens: 500 });
  expect(result.data.replyItalian).not.toMatch(/[а-яё]/i);
  expect(result.data.explanationRu).toContain("не проверены");
  expect(result.data.nextQuestion).toBe(prompts[0].question);
});
it("checks a voice transcript and ignores an assessment made stale by late speech results", async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal("fetch", fetcher);
  render(<ConversationPractice prompts={prompts} locale="en-GB" enableCheck />);
  fireEvent.click(screen.getByRole("button", { name: "Завершить распознавание" }));
  expect(screen.getByRole("textbox")).toHaveValue("I wake up at ten.");
  fireEvent.click(screen.getByRole("button", { name: "Проверить ответ" }));
  const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1];
  expect(JSON.parse(init.body as string).message).toBe("I wake up at ten.");
  fireEvent.click(screen.getByRole("button", { name: "Завершить распознавание" }));
  resolve(new Response(JSON.stringify(payload)));
  await waitFor(() => expect(screen.getByRole("button", { name: "Проверить ответ" })).toBeEnabled());
  expect(screen.queryByText(payload.explanationRu)).not.toBeInTheDocument();
});
it("instructs the live provider to assess English meaning and grammar with the given question", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] })));
  const provider = new OpenRouterTutorProvider(fetcher as never, "test-key");
  await provider.complete({ language: "en", message: answer, question: prompts[0].question, scenario: "intro", history: [], unlockedLessonIds: [], model: "test", maxOutputTokens: 500 });
  const request = JSON.parse((fetcher.mock.calls as unknown as [string, { body: string }][])[0][1].body);
  expect(request.messages[0].content).toContain("английского A1–B1");
  expect(request.messages[0].content).toContain("не требуй совпадения");
  expect(request.messages[1].content).toContain(prompts[0].question);
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentPacks } from "../content/registry";
import { basicConversations } from "../content/english/basic-conversations";
import { ConversationPractice } from "../client/src/components/ConversationPractice";
import { GuidedEnglishTutor } from "../client/src/components/GuidedEnglishTutor";
import { tts } from "../client/src/lib/speech";

describe("tutor questions are not lesson goals", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("has English prompts and model answers for every published English lesson", () => {
    const lessons = contentPacks.filter(pack => pack.languageKey === "en").flatMap(pack => pack.lessons);
    expect(lessons).toHaveLength(37);
    for (const lesson of lessons) {
      expect(lesson.conversation?.length, lesson.id).toBeGreaterThan(0);
      for (const prompt of lesson.conversation!) {
        if (/[а-яё]/i.test(lesson.goal)) expect(prompt.question, lesson.id).not.toBe(lesson.goal);
        expect(prompt.question).not.toMatch(/[а-яё]/i);
        expect(prompt.modelAnswer).not.toMatch(/[а-яё]/i);
        expect(prompt.modelAnswer.length).toBeGreaterThan(5);
        expect(prompt.tip.length).toBeGreaterThan(10);
      }
    }
  });
  it("reads the actual English question and reveals its matching answer", () => {
    const speak = vi.spyOn(tts, "speak").mockResolvedValue();
    render(<ConversationPractice prompts={basicConversations["daily-routine"]} locale="en-GB" />);
    fireEvent.click(screen.getByRole("button", { name: "Прослушать вопрос" }));
    expect(speak).toHaveBeenCalledWith("What time do you wake up, and when do you get up?", { lang: "en-GB", rate: 0.85 });
    fireEvent.click(screen.getByRole("button", { name: "Нужна подсказка" }));
    expect(screen.getByText("I wake up at seven and get up ten minutes later.")).toBeInTheDocument();
  });
  it("does not invent a question from a Russian goal when content is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ name: "Phrasal Verbs", lessons: [{ lesson_key: "daily-routine", title: "Повседневные действия", content: { goal: "Использовать базовые phrasal verbs", explanation: "Правило", words: [{ example: "I wake up at seven." }] } }] }))));
    render(<QueryClientProvider client={new QueryClient()}><GuidedEnglishTutor courseKey="english-phrasal-verbs-a2-b1" /></QueryClientProvider>);
    expect(await screen.findByText(/разговорные вопросы пока не подготовлены/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Прослушать вопрос" })).not.toBeInTheDocument();
    expect(screen.queryByText("Использовать базовые phrasal verbs")).not.toBeInTheDocument();
  });
});

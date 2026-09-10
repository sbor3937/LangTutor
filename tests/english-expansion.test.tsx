import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentPacks } from "../content/registry";
import { phrasalVerbLessons } from "../content/english/phrasal-verbs/v1";
import { photoConversationLessons } from "../content/english/photo-conversations";
import { juniorLessons } from "../content/english/junior";
import { ConversationPractice } from "../client/src/components/ConversationPractice";
import { BrowserSpeechSynthesisProvider } from "../client/src/lib/speech";

describe("English learning expansion", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("adds all 75 worksheet expressions without changing existing lessons", () => {
    const pack = contentPacks.find(item => item.courseKey === "english-phrasal-verbs-a2-b1")!;
    expect(pack.lessons.slice(0, 5)).toEqual(phrasalVerbLessons);
    expect(pack.version).toBe(1);
    expect(pack.lessons.map(item => item.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(photoConversationLessons.flatMap(item => item.words)).toHaveLength(75);
    expect(photoConversationLessons.flatMap(item => item.conversation ?? [])).toHaveLength(75);
    expect(photoConversationLessons.flatMap(item => item.words).map(item => item.target)).toEqual(expect.arrayContaining(["get along with", "flake out", "turn off", "get around to", "agree with", "wake up"]));
  });
  it("provides 12 school-age units with five scored phrases and conversation missions", () => {
    expect(juniorLessons).toHaveLength(12);
    for (const lesson of juniorLessons) {
      expect(lesson.words).toHaveLength(5);
      expect(lesson.conversation?.length).toBeGreaterThan(0);
      expect(lesson.explanation.length).toBeGreaterThan(80);
    }
    expect(contentPacks.find(item => item.courseKey === "english-junior-a1")?.targetLocale).toBe("en-GB");
  });
  it("offers a model on demand and clears answers when moving to another question", () => {
    render(<ConversationPractice locale="en-GB" prompts={photoConversationLessons[0].conversation!} />);
    expect(screen.queryByText("I get along with my cousin.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Нужна подсказка" }));
    expect(screen.getByText("I get along with my cousin.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "My friend" } });
    fireEvent.click(screen.getByRole("button", { name: "Другой вопрос" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("heading")).toHaveTextContent("museum");
  });
  it("chooses an English voice rather than the available Italian voice", async () => {
    const english = { lang: "en-GB" }, italian = { lang: "it-IT" };
    const speak = vi.fn((utterance: { onend: () => void }) => utterance.onend());
    vi.stubGlobal("SpeechSynthesisUtterance", class {});
    vi.stubGlobal("speechSynthesis", { getVoices: () => [italian, english], speak, cancel: vi.fn() });
    await new BrowserSpeechSynthesisProvider().speak("Hello", { lang: "en-GB" });
    expect(speak.mock.calls[0][0]).toMatchObject({ lang: "en-GB", voice: english });
  });
});

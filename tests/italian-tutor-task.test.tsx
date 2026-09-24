import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ItalianTutorTask, italianStarters } from "../client/src/components/ItalianTutorTask";
import { tts } from "../client/src/lib/speech";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("starts every selectable Italian scenario with a real question and an instruction", () => {
  const speak = vi.spyOn(tts, "speak").mockResolvedValue();
  for (const [scenario, starter] of Object.entries(italianStarters)) {
    render(<ItalianTutorTask scenario={scenario} />);
    expect(screen.getByText(starter.question)).toBeInTheDocument();
    expect(screen.getByText(/Что нужно сделать/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Прослушать вопрос" }));
    expect(speak).toHaveBeenLastCalledWith(starter.question, { lang: "it-IT", rate: 0.9 });
    expect(starter.question).not.toMatch(/[а-яё]/i);
    cleanup();
  }
});
it("speaks only the Italian part of a mixed next question", () => {
  const speak = vi.spyOn(tts, "speak").mockResolvedValue();
  render(<ItalianTutorTask scenario="intro" nextQuestion="Come stai? — Как дела?" />);
  fireEvent.click(screen.getByRole("button", { name: "Прослушать вопрос" }));
  expect(speak).toHaveBeenCalledWith("Come stai?", { lang: "it-IT", rate: 0.9 });
});
it("labels Russian instructions as tasks and does not speak them in Italian", () => {
  render(<ItalianTutorTask scenario="cafe" nextQuestion="Закажите напиток с Vorrei…, per favore." />);
  expect(screen.getByRole("heading", { name: "Ваше задание" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Прослушать вопрос" })).not.toBeInTheDocument();
});

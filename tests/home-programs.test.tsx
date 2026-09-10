import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InternetGate, InternetHomePage } from "../client/src/components/InternetApp";

const course = { key: "english-junior-a1", name: "English Junior", program_name: "Школьный английский", language_key: "en", language_name: "Английский", lesson_count: 12, metadata: { cefr: ["A1"] } };
function showHome(enrolled: boolean, failCatalog = false) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/auth/me")) return new Response(JSON.stringify({ user_id: "u", display_name: "Ученик", email: "u@example.test", familyId: "f" }));
    if (url.endsWith("/enrollments")) return new Response(JSON.stringify({ enrollments: enrolled ? [{ course_key: course.key, course_name: course.name, language_name: course.language_name }] : [] }));
    return new Response(JSON.stringify({ courses: [course] }), { status: failCatalog ? 500 : 200 });
  }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Routes><Route element={<InternetGate />}><Route path="/" element={<InternetHomePage />} /></Route></Routes></MemoryRouter></QueryClientProvider>);
}
describe("home course blocks", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("separates continuing from the full catalog and opens enrolled courses directly", async () => {
    showHome(true);
    const continuing = await screen.findByRole("region", { name: "Продолжить обучение" });
    expect(within(continuing).getByRole("link", { name: "Открыть уроки" })).toHaveAttribute("href", "/programs/english-junior-a1");
    const catalog = screen.getByRole("region", { name: "Программы обучения" });
    expect(await within(catalog).findByRole("link", { name: "Открыть курс" })).toHaveAttribute("href", "/programs/english-junior-a1");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
  it("shows an empty continuing block and onboarding for a new learner", async () => {
    showHome(false);
    expect(await screen.findByText(/Вы пока не начали/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Выбрать программу" })).toHaveAttribute("href", "/onboarding/english-junior-a1");
  });
  it("keeps current lessons accessible when the catalog fails", async () => {
    showHome(true, true);
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить");
    expect(screen.getByRole("link", { name: "Открыть уроки" })).toBeInTheDocument();
  });
});

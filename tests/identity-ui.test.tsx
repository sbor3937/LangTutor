import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthPage } from "../client/src/components/AuthPage";
import { ResetPasswordPage, VerifyEmailPage } from "../client/src/components/IdentityLifecyclePage";
import { afterEach, vi } from "vitest";

describe("AuthPage", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("exposes keyboard-operable login and registration fields", () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Регистрация" }));
    expect(screen.getByRole("heading", { name: "Создание аккаунта" })).toBeInTheDocument();
    expect(screen.getByLabelText("Имя")).toBeRequired();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Пароль")).toHaveAttribute("minlength", "12");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("offers an enumeration-safe password recovery request", async () => {
    const fetcher = vi.fn(async (...args: [string, RequestInit?]) => { void args; return new Response(JSON.stringify({ status: "accepted" }), { status: 202 }); });
    vi.stubGlobal("fetch", fetcher);
    render(<MemoryRouter><AuthPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Забыли пароль?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "learner@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Получить письмо" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Если аккаунт существует");
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({ email: "learner@example.test" });
  });

  it("confirms email from the tokenized link", async () => {
    const fetcher = vi.fn(async (...args: [string, RequestInit?]) => { void args; return new Response(JSON.stringify({ status: "verified" }), { status: 200 }); });
    vi.stubGlobal("fetch", fetcher);
    render(<MemoryRouter initialEntries={["/verify-email?token=abcdefghijklmnopqrstuvwxyz123456"]}><VerifyEmailPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Email подтверждён"));
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({ token: "abcdefghijklmnopqrstuvwxyz123456" });
  });

  it("changes password from a reset link", async () => {
    const fetcher = vi.fn(async (...args: [string, RequestInit?]) => { void args; return new Response(JSON.stringify({ status: "password_changed" }), { status: 200 }); });
    vi.stubGlobal("fetch", fetcher);
    render(<MemoryRouter initialEntries={["/reset-password?token=abcdefghijklmnopqrstuvwxyz123456"]}><ResetPasswordPage /></MemoryRouter>);
    fireEvent.change(within(screen.getByRole("form")).getByLabelText("Новый пароль"), { target: { value: "a secure new password" } });
    fireEvent.click(screen.getByRole("button", { name: "Изменить пароль" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Пароль изменён"));
  });
});

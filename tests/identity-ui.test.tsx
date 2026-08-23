import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthPage } from "../client/src/components/AuthPage";

describe("AuthPage", () => {
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
});

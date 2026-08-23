import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { JoinFamily } from "../client/src/components/FamilyAdmin";

describe("JoinFamily", () => {
  it("requires reauthentication and exposes a text status", () => {
    render(<MemoryRouter initialEntries={["/join-family?token=abcdefghijklmnopqrstuvwxyz1234567890"]}><JoinFamily /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Вступление в семью" })).toBeInTheDocument();
    expect(screen.getByLabelText("Пароль")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

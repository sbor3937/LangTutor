import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../shared/identity-schemas";

describe("identity boundaries", () => {
  it("normalizes email without weakening password requirements", () => {
    const parsed = registerSchema.parse({ email: "  USER@Example.COM ", password: "correct horse battery staple", displayName: "Анна" });
    expect(parsed.email).toBe("user@example.com");
  });

  it("rejects short passwords and malformed email", () => {
    expect(loginSchema.safeParse({ email: "not-email", password: "short" }).success).toBe(false);
  });
});

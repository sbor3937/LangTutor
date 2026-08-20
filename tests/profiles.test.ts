import { beforeEach, describe, expect, it } from "vitest";
import {
  activateProfile,
  isProfileOnboarded,
  migrateLegacyProfile,
  readProfiles,
  removeProfile,
  upsertProfile,
} from "../client/src/lib/profiles";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

describe("local family profiles", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      },
    });
  });

  it("migrates the existing learner without changing its id", () => {
    localStorage.setItem("italian-onboarded", "1");
    migrateLegacyProfile(first);
    expect(readProfiles()[0]).toMatchObject({ id: first, onboarded: true });
  });

  it("keeps two learners separate and switches the active id", () => {
    migrateLegacyProfile(first);
    upsertProfile(first, { name: "София", onboarded: true });
    upsertProfile(second, { name: "Борис", onboarded: true });
    activateProfile(second);
    expect(localStorage.getItem("italian-anonymous-id")).toBe(second);
    expect(readProfiles().map((profile) => profile.name)).toEqual([
      "София",
      "Борис",
    ]);
  });

  it("removes only the selected local profile", () => {
    upsertProfile(first, { name: "София", onboarded: true });
    upsertProfile(second, { name: "Борис", onboarded: false });
    removeProfile(first);
    expect(readProfiles()).toHaveLength(1);
    expect(isProfileOnboarded(second)).toBe(false);
  });
});

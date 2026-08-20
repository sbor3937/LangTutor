import { z } from "zod";

const profileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(80),
  onboarded: z.boolean(),
  createdAt: z.string(),
});
const registrySchema = z.array(profileSchema).max(20);
export type LocalProfile = z.infer<typeof profileSchema>;

const REGISTRY_KEY = "italian-local-profiles";
const ACTIVE_ID_KEY = "italian-anonymous-id";

export function readProfiles(): LocalProfile[] {
  try {
    return registrySchema.parse(
      JSON.parse(localStorage.getItem(REGISTRY_KEY) || "[]"),
    );
  } catch {
    return [];
  }
}

function writeProfiles(profiles: LocalProfile[]) {
  localStorage.setItem(
    REGISTRY_KEY,
    JSON.stringify(registrySchema.parse(profiles)),
  );
}

export function migrateLegacyProfile(id: string) {
  const profiles = readProfiles();
  if (profiles.some((profile) => profile.id === id)) return;
  const legacyOnboarded = localStorage.getItem("italian-onboarded") === "1";
  writeProfiles([
    ...profiles,
    {
      id,
      name: legacyOnboarded ? "Текущий пользователь" : "Новый пользователь",
      onboarded: legacyOnboarded,
      createdAt: new Date().toISOString(),
    },
  ]);
}

export function upsertProfile(
  id: string,
  changes: Partial<Pick<LocalProfile, "name" | "onboarded">>,
) {
  const profiles = readProfiles();
  const current = profiles.find((profile) => profile.id === id);
  const next: LocalProfile = {
    id,
    name: changes.name ?? current?.name ?? "Новый пользователь",
    onboarded: changes.onboarded ?? current?.onboarded ?? false,
    createdAt: current?.createdAt ?? new Date().toISOString(),
  };
  writeProfiles([...profiles.filter((profile) => profile.id !== id), next]);
  return next;
}

export function removeProfile(id: string) {
  writeProfiles(readProfiles().filter((profile) => profile.id !== id));
}

export function activateProfile(id: string) {
  const profile = profileSchema.parse(
    readProfiles().find((item) => item.id === id),
  );
  localStorage.setItem(ACTIVE_ID_KEY, profile.id);
}

export function isProfileOnboarded(id: string) {
  return (
    readProfiles().find((profile) => profile.id === id)?.onboarded ?? false
  );
}

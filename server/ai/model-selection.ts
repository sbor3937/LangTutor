type ModelConfig = { liveAI: boolean; aiModelKey: string; kodikrouterKey: string; openrouterKey: string };

/** Never send an answer to a different provider because its key happens to exist. */
export function selectTutorModel(settings: ModelConfig): string {
  if (!settings.liveAI) return "demo/italian-a0";
  const provider = settings.aiModelKey.split("/")[0];
  const configured = provider === "kodikrouter" ? settings.kodikrouterKey
    : provider === "openrouter" ? settings.openrouterKey : "";
  return configured ? settings.aiModelKey : "demo/italian-a0";
}

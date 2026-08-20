import { fetch as undiciFetch, FormData, ProxyAgent } from "undici";
import { z } from "zod";
import { config } from "../config.js";

const transcriptionSchema = z.object({ text: z.string().max(5000) });
const proxyAgent = config.groqProxyUrl
  ? new ProxyAgent(config.groqProxyUrl)
  : undefined;

export async function transcribeItalian(audio: Buffer, mimeType: string) {
  if (!config.groqKey) throw new Error("STT_NOT_CONFIGURED");
  const extension = mimeType.includes("ogg")
    ? "ogg"
    : mimeType.includes("mp4")
      ? "m4a"
      : "webm";
  const form = new FormData();
  form.append(
    "file",
    new Blob([audio], { type: mimeType }),
    `speech.${extension}`,
  );
  form.append("model", config.groqModel);
  form.append("language", "it");
  form.append("response_format", "json");
  const response = await undiciFetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.groqKey}` },
      body: form,
      dispatcher: proxyAgent,
    },
  );
  if (!response.ok) throw new Error(`STT_UPSTREAM_${response.status}`);
  return transcriptionSchema.parse(await response.json()).text.trim();
}

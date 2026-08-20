export interface TTSOptions {
  rate?: number;
  lang?: string;
}
export interface TTSProvider {
  speak(text: string, options?: TTSOptions): Promise<void>;
  stop(): void;
  isAvailable(): boolean;
}
export class BrowserSpeechSynthesisProvider implements TTSProvider {
  isAvailable() {
    return "speechSynthesis" in window;
  }
  stop() {
    window.speechSynthesis?.cancel();
  }
  async speak(text: string, options: TTSOptions = {}) {
    if (!this.isAvailable()) throw new Error("unavailable");
    this.stop();
    await new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = options.lang || "it-IT";
      u.rate = options.rate || 1;
      const voices = speechSynthesis.getVoices();
      u.voice =
        voices.find((v) => v.lang.toLowerCase().startsWith("it")) || null;
      u.onend = () => resolve();
      u.onerror = () => reject(new Error("speech"));
      speechSynthesis.speak(u);
    });
  }
}
export interface STTResult {
  transcript: string;
  confidence?: number;
  error?: string;
}
export interface STTOptions {
  onInterim?: (s: string) => void;
  onFinal?: (s: string) => void;
  onError?: (code: string) => void;
  onEnd?: (s: string) => void;
}
export interface STTProvider {
  start(options?: STTOptions): Promise<void>;
  stop(): Promise<STTResult>;
  isAvailable(): boolean;
}
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};
export class BrowserSpeechRecognitionProvider implements STTProvider {
  private recognition?: Recognition;
  private transcript = "";
  private error = "";
  private ended = true;
  isAvailable() {
    return Boolean(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition,
    );
  }
  async start(options: STTOptions = {}) {
    const C =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!C) throw new Error("unavailable");
    this.dispose();
    this.transcript = "";
    this.error = "";
    this.ended = false;
    const recognition: Recognition = new C();
    this.recognition = recognition;
    recognition.lang = "it-IT";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      let combined = "";
      let hasFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        combined += `${event.results[i][0].transcript} `;
        hasFinal = hasFinal || Boolean(event.results[i].isFinal);
      }
      this.transcript = combined.trim();
      options.onInterim?.(this.transcript);
      if (hasFinal) options.onFinal?.(this.transcript);
    };
    recognition.onerror = (event: any) => {
      this.error = String(event.error || "unknown");
      options.onError?.(this.error);
    };
    recognition.onend = () => {
      this.ended = true;
      options.onEnd?.(this.transcript);
    };
    recognition.start();
  }
  async stop() {
    if (!this.recognition || this.ended)
      return { transcript: this.transcript, error: this.error || undefined };
    return new Promise<STTResult>((resolve) => {
      const recognition = this.recognition!;
      const previousEnd = recognition.onend;
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        this.ended = true;
        resolve({
          transcript: this.transcript,
          error: this.error || undefined,
        });
      };
      recognition.onend = () => {
        previousEnd?.();
        finish();
      };
      try {
        recognition.stop();
      } catch {
        finish();
      }
      setTimeout(finish, 2000);
    });
  }
  dispose() {
    if (this.recognition && !this.ended) {
      try {
        this.recognition.abort();
      } catch {
        /* already stopped */
      }
    }
    this.recognition = undefined;
    this.ended = true;
  }
}
const cloudResultSchema = z.object({ transcript: z.string().max(5000) });
export class CloudSpeechRecognitionProvider implements STTProvider {
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private options: STTOptions = {};
  isAvailable() {
    return Boolean(navigator.mediaDevices && window.MediaRecorder);
  }
  async start(options: STTOptions = {}) {
    if (!this.isAvailable()) throw new Error("unavailable");
    this.dispose();
    this.options = options;
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferred = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    this.recorder = preferred
      ? new MediaRecorder(this.stream, { mimeType: preferred })
      : new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.start(250);
  }
  async stop(): Promise<STTResult> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive")
      return { transcript: "", error: "audio-capture" };
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(
          new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }),
        );
      recorder.stop();
    });
    this.stopTracks();
    try {
      const response = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": blob.type.split(";")[0] },
        body: blob,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const serverCode = payload?.error?.code;
        throw new Error(serverCode || `cloud-${response.status}`);
      }
      const { transcript } = cloudResultSchema.parse(await response.json());
      this.options.onFinal?.(transcript);
      return { transcript };
    } catch (error) {
      const code = error instanceof Error ? error.message : "cloud-error";
      this.options.onError?.(code);
      return { transcript: "", error: code };
    } finally {
      this.chunks = [];
      this.recorder = undefined;
    }
  }
  private stopTracks() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
  dispose() {
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.stopTracks();
    this.chunks = [];
    this.recorder = undefined;
  }
}
export class TextFallbackProvider implements STTProvider {
  constructor(private text = "") {}
  isAvailable() {
    return true;
  }
  async start() {}
  async stop() {
    return { transcript: this.text };
  }
  setText(t: string) {
    this.text = t;
  }
}
export const tts = new BrowserSpeechSynthesisProvider();
import { z } from "zod";

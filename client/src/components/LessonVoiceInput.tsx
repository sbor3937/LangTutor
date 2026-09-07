import { useEffect, useMemo, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { BrowserSpeechRecognitionProvider, tts } from "../lib/speech";

export function LessonVoiceInput({ locale, disabled, onTranscript, onStart }: {
  locale: string; disabled: boolean; onTranscript: (text: string) => void | Promise<void>; onStart?: () => void;
}) {
  const recognition = useMemo(() => new BrowserSpeechRecognitionProvider(), []);
  const generation = useRef(0), active = useRef(false), stopping = useRef(false);
  const [recording, setRecording] = useState(false), [status, setStatus] = useState("");
  useEffect(() => () => { generation.current++; active.current = false; recognition.dispose(); }, [recognition]);
  async function start() {
    if (disabled || active.current) return;
    if (!recognition.isAvailable()) { setStatus("Микрофон недоступен в этом браузере. Попробуйте Chrome или Edge."); return; }
    const run = ++generation.current;
    onStart?.();
    active.current = true; stopping.current = false; setRecording(true); setStatus("Слушаю… Отпустите кнопку, чтобы закончить."); tts.stop();
    let finished = false, failed = false;
    const finish = (text: string) => {
      if (finished || generation.current !== run) return;
      finished = true; active.current = false; setRecording(false);
      if (failed) return;
      if (!text.trim()) { setStatus("Речь не распознана. Попробуйте ещё раз."); return; }
      setStatus(""); void onTranscript(text.trim());
    };
    try {
      await recognition.start({ lang: locale, onEnd: finish, onError: () => {
        if (finished || generation.current !== run) return;
        failed = true; active.current = false; setRecording(false); setStatus("Не удалось распознать речь. Проверьте разрешение на микрофон.");
      } });
    } catch { if (generation.current === run) { active.current = false; setRecording(false); setStatus("Не удалось включить микрофон."); } }
  }
  async function stop() {
    if (!active.current || stopping.current) return;
    stopping.current = true; setStatus("Распознаём…"); await recognition.stop();
  }
  return <div>
    <button type="button" style={{ touchAction: "none" }} className={recording ? "mic-button recording" : "mic-button"} disabled={disabled}
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture?.(event.pointerId); void start(); }}
      onPointerUp={() => void stop()} onPointerCancel={() => { generation.current++; active.current = false; recognition.dispose(); setRecording(false); setStatus("Запись отменена."); }}
      onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) void start(); } }}
      onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); void stop(); } }}
      onBlur={() => void stop()} onClick={event => { if (event.detail === 0) { if (active.current) void stop(); else void start(); } }}
      aria-pressed={recording}><Mic aria-hidden="true" />{recording ? "Отпустите, чтобы закончить" : "Произнести"}</button>
    <p>Удерживайте кнопку или клавишу пробела во время ответа.</p>
    {status && <p role="status">{status}</p>}
  </div>;
}

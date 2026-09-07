import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LessonVoiceInput } from "../client/src/components/LessonVoiceInput";

class Recognition {
  static current: Recognition;
  lang = ""; onend?: () => void; onerror?: (event: { error: string }) => void;
  onresult?: (event: unknown) => void;
  constructor() { Recognition.current = this; }
  start() {}
  stop() { this.onend?.(); }
  abort() { this.onend?.(); }
  result(text: string) { this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); }
}
describe("lesson voice input", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("submits once on release, not on recognition results, using the course locale", async () => {
    vi.stubGlobal("SpeechRecognition", Recognition);
    vi.stubGlobal("PointerEvent", MouseEvent);
    const received = vi.fn();
    render(<LessonVoiceInput locale="en-GB" disabled={false} onTranscript={received} />);
    const button = screen.getByRole("button");
    fireEvent.pointerDown(button, { button: 0 });
    act(() => Recognition.current.result("Hello"));
    expect(received).not.toHaveBeenCalled();
    expect(Recognition.current.lang).toBe("en-GB");
    await act(async () => { fireEvent.pointerUp(button, { button: 0 }); });
    act(() => Recognition.current.onend?.());
    expect(received).toHaveBeenCalledExactlyOnceWith("Hello");
  });
  it("ignores late results after leaving and does not submit errors", () => {
    vi.stubGlobal("SpeechRecognition", Recognition);
    const received = vi.fn();
    const view = render(<LessonVoiceInput locale="it-IT" disabled={false} onTranscript={received} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    act(() => { Recognition.current.result("Ciao"); Recognition.current.onerror?.({ error: "not-allowed" }); Recognition.current.onend?.(); });
    expect(received).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    const lateEnd = Recognition.current.onend;
    view.unmount();
    act(() => lateEnd?.());
    expect(received).not.toHaveBeenCalled();
  });
});

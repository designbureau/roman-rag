import { useEffect, useRef, useState } from "react";
import { useSpeech } from "./use-speech";
import type { GalleryFigure } from "~/data/gallery-figures";

type Message = { role: "user" | "figure"; text: string };

// Remount this per figure (key={figure.id} at the call site) so switching
// figures resets the thread and re-triggers the greeting.
export function AskPanel({
  figure,
  pace = 160,
  onSpeakingChange,
}: {
  figure: GalleryFigure;
  pace?: number;
  onSpeakingChange?: (speaking: boolean) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const { visible, speaking, speak } = useSpeech(pace);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onSpeakingChange?.(speaking);
  }, [speaking, onSpeakingChange]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, visible]);

  const ask = (i: number) => {
    const qa = figure.qa[i];
    if (!qa) return;
    setMessages((m) => [...m, { role: "user", text: qa.q }]);
    speak(qa.a, () => {
      setMessages((m) => [...m, { role: "figure", text: qa.a }]);
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={threadRef} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto pr-1.5">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-md bg-[color:var(--accent)] px-3.5 py-2.5 font-sans text-lg leading-snug text-[#14120E]"
                  : "max-w-[80%] rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-3.5 py-2.5 font-sans text-lg leading-snug text-[#E3DAC6]"
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {speaking && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 px-3.5 py-2.5 font-sans text-lg leading-snug text-[#E3DAC6]">
              {visible}
              <span className="blink-cursor ml-0.5 text-[color:var(--accent)]">▍</span>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-shrink-0 flex-col">
        <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8A7E66]">
          Ask {figure.first}
        </div>
        <div className="flex flex-col gap-2">
          {figure.qa.map((qa, i) => (
            <button
              key={qa.q}
              onClick={() => ask(i)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left font-sans text-sm text-[#E3DAC6] transition-colors hover:border-[color:var(--accent)]/50 hover:bg-white/[0.07]"
            >
              {qa.q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

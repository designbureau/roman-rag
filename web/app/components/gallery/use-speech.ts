import { useCallback, useEffect, useRef, useState } from "react";

// Simulates text-to-speech by revealing a line word-by-word on a timer —
// there's no real TTS behind this yet, just a typewriter pace matching the
// original design's `speak()` behaviour (ms/word, with a short trailing
// pause before the "speaking" state clears).
export function useSpeech(paceMs = 160) {
  const [text, setText] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const speak = useCallback(
    (full: string, onDone?: () => void) => {
      stop();
      const total = full.trim().split(/\s+/).length;
      setText(full);
      setWordCount(0);
      setSpeaking(true);
      let i = 0;
      timerRef.current = setInterval(() => {
        i++;
        setWordCount(i);
        if (i >= total) {
          stop();
          setTimeout(() => {
            setSpeaking(false);
            onDone?.();
          }, 320);
        }
      }, paceMs);
    },
    [paceMs, stop],
  );

  useEffect(() => stop, [stop]);

  const visible = text.split(/\s+/).slice(0, wordCount).join(" ");
  return { visible, speaking, speak, stop };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { SPEAK_FN_URL, SUPABASE_ANON_KEY } from "~/lib/config";
import { setTtsStatus, useTtsStatus } from "~/lib/tts-availability";

// Same fetch → decode → <audio> → per-word timing pipeline as chat-panel.tsx's
// PlayButton, but self-contained and auto-triggered rather than click-
// triggered — PlayButton is shared by the main site's chat and the Stage
// view, so this stays a separate (small, duplicated) implementation rather
// than refactoring that shared, working component to fit a third call site.
type WordTiming = { index: number; start: number; end: number; text: string };

export type RingSpeechStatus = "idle" | "loading" | "playing" | "paused" | "error";

export function useRingSpeech(persona: string) {
  const ttsStatus = useTtsStatus();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const wordsRef = useRef<WordTiming[]>([]);
  const lastWordIdxRef = useRef(-1);
  const [status, setStatus] = useState<RingSpeechStatus>("idle");
  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setStatus("idle");
    setActiveWordIndex(-1);
  }, []);

  // Pause/resume leave audioRef and its currentTime alone (unlike stop,
  // which tears the element down) — resuming just calls .play() again,
  // and the existing onplay handler flips status back to "playing", so
  // ontimeupdate/word-highlighting picks up exactly where it left off.
  const pause = useCallback(() => {
    audioRef.current?.pause();
    setStatus((s) => (s === "playing" ? "paused" : s));
  }, []);

  const resume = useCallback(() => {
    if (!audioRef.current) return;
    void audioRef.current.play().catch(() => setStatus("error"));
  }, []);

  const play = useCallback(
    async (text: string) => {
      if (ttsStatus === "unavailable" || !text.trim()) return;
      stop();
      setStatus("loading");
      try {
        const res = await fetch(SPEAK_FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ text, persona }),
        });
        if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) {
          setTtsStatus("unavailable");
          setStatus("error");
          return;
        }
        setTtsStatus("available");
        const payload = (await res.json()) as {
          audio: string;
          mime: string;
          words: WordTiming[];
        };
        const bytes = Uint8Array.from(atob(payload.audio), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: payload.mime || "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        wordsRef.current = payload.words ?? [];
        lastWordIdxRef.current = -1;
        const audio = new Audio(url);
        audio.onplay = () => setStatus("playing");
        audio.onended = () => {
          setStatus("idle");
          lastWordIdxRef.current = -1;
          setActiveWordIndex(-1);
        };
        audio.onerror = () => setStatus("error");
        audio.ontimeupdate = () => {
          const words = wordsRef.current;
          if (!words.length) return;
          let i = Math.max(0, lastWordIdxRef.current);
          if (i >= words.length || audio.currentTime < words[i]!.start) i = 0;
          while (i + 1 < words.length && audio.currentTime >= words[i + 1]!.start) i++;
          if (i !== lastWordIdxRef.current) {
            lastWordIdxRef.current = i;
            setActiveWordIndex(words[i]!.index);
          }
        };
        audioRef.current = audio;
        await audio.play();
      } catch {
        setStatus("error");
      }
    },
    [persona, ttsStatus, stop],
  );

  return { play, stop, pause, resume, status, activeWordIndex };
}

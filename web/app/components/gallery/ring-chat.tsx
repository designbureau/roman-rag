import { useChat } from "@ai-sdk/react";
import gsap from "gsap";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  CHAT_FN_URL,
  SUPABASE_ANON_KEY,
  TRANSCRIBE_FN_URL,
} from "~/lib/config";
import { useRingSpeech } from "./use-ring-speech";
import { prefersReducedMotion } from "~/lib/reduced-motion";
import type { GalleryFigure } from "~/data/gallery-figures";

// Mirrors supabase/functions/speak/index.ts's stripMarkdown exactly, so the
// word list built here indexes the same way the server's word-timing array
// does (it tokenizes this same markdown-stripped text). Trailing content the
// server trims (story-suggestion links) simply never gets a matching index
// back — those words stay visible here but never highlight, same as the
// main chat's behavior.
function stripMarkdownForSpeech(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Narrow, overflow-hidden column — the currently-playing response scrolls
// vertically to keep the spoken word centered, like a vertical teleprompter
// rather than a chat transcript. Position is driven by measuring the active
// word's own offset within the column on every activeIndex change.
// Trailing-only fade: upcoming (not-yet-spoken) words stay fully hidden —
// no preview — while the active word and the couple before it fade up and
// out as they scroll past. Words further back than this are invisible
// (still occupy layout height, just at opacity 0) rather than abruptly
// appearing/disappearing at the edge.
const FADE_WINDOW = 2;
function opacityFor(index: number, activeIndex: number): number {
  if (activeIndex < 0) return 1;
  if (index > activeIndex) return 0;
  const distance = activeIndex - index;
  if (distance === 0) return 1;
  if (distance > FADE_WINDOW) return 0;
  return 1 - distance / (FADE_WINDOW + 1);
}

function NowPlayingStrip({
  words,
  activeIndex,
}: {
  words: string[];
  activeIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const wordElsRef = useRef<Array<HTMLDivElement | null>>([]);
  // Per-word array of its own letter spans, separate from the outer div's
  // opacity (still driven by opacityFor/React below) — GSAP only ever
  // touches these, so it never fights a React re-render for ownership of
  // the same style property.
  const letterElsRef = useRef<Array<Array<HTMLSpanElement | null>>>([]);
  const prevActiveRef = useRef(-1);

  // Letter-reveal animation, à la a SplitText chars stagger: the word that
  // just became active has its letters slide/fade in one after another
  // rather than the whole word snapping straight to fully visible, and the
  // word that was active a moment ago settles down slightly as it starts
  // fading into the trailing window above.
  useEffect(() => {
    const prev = prevActiveRef.current;
    // Under reduced motion the words simply appear/disappear via the
    // outer div's opacity (see opacityFor) with no per-letter tween.
    if (prefersReducedMotion()) {
      prevActiveRef.current = activeIndex;
      return;
    }
    if (activeIndex >= 0 && activeIndex !== prev) {
      // Filter out nulls: word divs remount as `words` grows/shrinks with
      // streamed content, and React's ref-callback cleanup (element -> null)
      // can leave stale null entries in an index's letter array without
      // shrinking it — passing those straight to gsap crashes trying to read
      // `_gsap` off null.
      const enter = (letterElsRef.current[activeIndex] ?? []).filter(
        (el): el is HTMLSpanElement => el !== null,
      );
      if (enter.length) {
        gsap.fromTo(
          enter,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", stagger: 0.025 },
        );
      }
      if (prev >= 0) {
        const exit = (letterElsRef.current[prev] ?? []).filter(
          (el): el is HTMLSpanElement => el !== null,
        );
        if (exit.length) {
          gsap.to(exit, { y: 6, duration: 0.4, ease: "power2.out" });
        }
      }
    }
    prevActiveRef.current = activeIndex;
  }, [activeIndex]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const column = columnRef.current;
    if (!container || !column) return;
    // Active word settles near the BOTTOM of the box (with a little
    // breathing room below it) rather than dead-center, so the trailing
    // fade-out words read as scrolling up and off, caption-style, instead
    // of the active word sitting in the middle of empty space.
    const targetY = container.clientHeight - 24;
    // Before playback (activeIndex -1), anchor on the first word instead of
    // the whole column's midpoint — the first word's own offset barely moves
    // as more streamed words are appended after it, so this settles once
    // and holds still. Centering the *whole* block instead re-centers on
    // every streamed token (the block's midpoint keeps sliding as it grows),
    // which read as constant jittery motion rather than a settled start.
    const anchorEl = wordElsRef.current[activeIndex] ?? wordElsRef.current[0];
    if (!anchorEl) {
      column.style.transform = "translateY(0px)";
      return;
    }
    const anchorCenter = anchorEl.offsetTop + anchorEl.offsetHeight / 2;
    column.style.transform = `translateY(${targetY - anchorCenter}px)`;
  }, [activeIndex, words]);

  return (
    <div
      ref={containerRef}
      // pointer-events-auto against the parent's pointer-events-none (see
      // ring-chat.tsx's RingChat) — that parent spans the full width so
      // clicks either side of this strip still fall through to the ring
      // underneath, but without this, `pointer-events: none` would inherit
      // onto this box (and its word spans) too, making the ticker itself
      // unclickable/unselectable. Tall enough to show the full ±2-word
      // fade window above and below the active word.
      className="relative pointer-events-auto mx-auto h-[230px] w-full max-w-md overflow-hidden"
    >
      <div
        ref={columnRef}
        className="absolute left-0 top-0 flex w-full flex-col items-center transition-transform duration-200 ease-out"
      >
        {words.map((w, i) => (
          <div
            key={i}
            ref={(el) => {
              wordElsRef.current[i] = el;
            }}
            className="my-1.5 font-display text-2xl uppercase transition-[color,opacity] duration-300"
            // .font-display sets a tight -0.022em letter-spacing (tuned for
            // headings, not this uppercase ticker) — overridden inline since
            // an equal-specificity class can't reliably beat it via source
            // order alone.
            style={{
              color: i === activeIndex ? "var(--accent)" : "#E3DAC6",
              letterSpacing: "0.06em",
              opacity: opacityFor(i, activeIndex),
            }}
          >
            {w.split("").map((ch, j) => (
              <span
                key={j}
                ref={(el) => {
                  if (!letterElsRef.current[i]) letterElsRef.current[i] = [];
                  letterElsRef.current[i][j] = el;
                }}
                className="inline-block"
              >
                {ch}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="5" y="4" width="5" height="16" rx="1" />
      <rect x="14" y="4" width="5" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4.5v15l14-7.5z" />
    </svg>
  );
}

type MicState = "idle" | "recording" | "transcribing" | "error";

// Imperative start/stop so RingChat's spacebar push-to-talk (hold to
// record, release to send) can drive this button's recording without
// duplicating its VAD/MediaRecorder plumbing — the click handler below
// calls the exact same functions.
export type RingMicHandle = { start: () => void; stop: () => void };

// Voice input for the ring: press to talk, auto-stops on silence (same VAD
// approach as chat-panel.tsx's MicButton — recorded via MediaRecorder, timed
// out via a Web Audio RMS analyser rather than a fixed duration), then posts
// to /transcribe and calls onResult. A separate small implementation rather
// than sharing that component: this one auto-submits the transcript instead
// of just filling a text input (there's no submit button here to press
// afterwards), which changes enough of the control flow that reusing it
// would mean threading a submit-vs-fill mode through a component built for
// a different call site.
const RingMicButton = forwardRef<
  RingMicHandle,
  { disabled: boolean; onResult: (text: string) => void }
>(function RingMicButton({ disabled, onResult }, ref) {
  const [state, setState] = useState<MicState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const VAD_THRESHOLD = 0.02;
  const SILENCE_MS = 1500;
  const MAX_SILENT_MS = 8000;

  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const teardownVad = () => {
    if (vadRafRef.current !== null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      teardownVad();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, []);

  const upload = async (blob: Blob) => {
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      form.append("audio", blob, `dictation.${ext}`);
      const res = await fetch(TRANSCRIBE_FN_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: form,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const j = (await res.json()) as { text?: string };
      const text = (j.text ?? "").trim();
      setState("idle");
      if (text) onResult(text);
    } catch {
      setState("error");
    }
  };

  const stop = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      setState("transcribing");
      rec.stop();
    }
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        teardownVad();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0 || !hasSpokenRef.current) {
          setState("idle");
          return;
        }
        void upload(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setState("recording");

      try {
        const Ctx: typeof AudioContext =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        hasSpokenRef.current = false;
        startedAtRef.current = performance.now();
        lastSpeechAtRef.current = startedAtRef.current;

        const tick = () => {
          if (!recorderRef.current || recorderRef.current.state !== "recording") {
            return;
          }
          analyser.getFloatTimeDomainData(buf);
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) {
            const s = buf[i] ?? 0;
            sumSq += s * s;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          const now = performance.now();
          if (rms > VAD_THRESHOLD) {
            hasSpokenRef.current = true;
            lastSpeechAtRef.current = now;
          }
          const silentFor = now - lastSpeechAtRef.current;
          const totalElapsed = now - startedAtRef.current;
          if (hasSpokenRef.current && silentFor > SILENCE_MS) {
            stop();
            return;
          }
          if (!hasSpokenRef.current && totalElapsed > MAX_SILENT_MS) {
            stop();
            return;
          }
          vadRafRef.current = requestAnimationFrame(tick);
        };
        vadRafRef.current = requestAnimationFrame(tick);
      } catch {
        // Web Audio failed — manual stop only; recording still works.
      }
    } catch {
      setState("error");
    }
  };

  // No deps array: always exposes functions closing over the latest
  // `state`, so a spacebar keyup racing a state update still sees the
  // current recording state rather than whatever it was on mount.
  useImperativeHandle(ref, () => ({
    start: () => {
      if (state === "idle") void start();
    },
    stop: () => {
      if (state === "recording") stop();
    },
  }));

  if (!supported) return null;

  const onClick = () => {
    if (state === "recording") return stop();
    if (state === "transcribing") return;
    void start();
  };

  const title =
    state === "recording"
      ? "Stop and ask"
      : state === "transcribing"
        ? "Transcribing…"
        : state === "error"
          ? "Couldn't hear that — try again"
          : "Ask by voice";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "transcribing"}
      title={title}
      aria-label={title}
      // Absolutely positioned inside the input's own pill (see its wrapping
      // div in RingChat below) rather than sitting beside it as a separate
      // chip — no border/bg of its own now, just an icon that tints on
      // state, matching the input's inner padding on the right.
      className={`absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
        state === "recording"
          ? "animate-pulse bg-red-500/20 text-red-400"
          : "text-[#9A8E74] hover:text-[color:var(--accent)]"
      }`}
    >
      {state === "transcribing" ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
    </button>
  );
});

// The gallery's ring-embedded chat: bottom-center input, no chat transcript
// or per-message bubbles — just the single currently-playing line above it
// (see NowPlayingStrip). Remount per figure (key={figure.id} at the call
// site in gallery.tsx) so switching figures resets the thread and stops any
// in-flight speech.
export function RingChat({ figure }: { figure: GalleryFigure }) {
  const persona = figure.personaKey;
  const { messages, isLoading, input, handleInputChange, handleSubmit, append } =
    useChat({
      api: CHAT_FN_URL,
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: { persona: persona ?? "", retrievalFilters: {}, tier: "" },
    });
  const speech = useRingSpeech(persona ?? "");
  // Guards against re-speaking the same message (e.g. on unrelated re-renders).
  const spokenIdRef = useRef<string | null>(null);
  const micRef = useRef<RingMicHandle>(null);

  const last = messages[messages.length - 1];
  const complete =
    last?.role === "assistant" && !isLoading && last.content.trim().length > 0;

  useEffect(() => {
    if (!complete || !persona) return;
    if (spokenIdRef.current === last.id) return;
    spokenIdRef.current = last.id;
    speech.play(stripMarkdownForSpeech(last.content));
    // speech.play is stable-enough (only changes with persona/ttsStatus);
    // re-running this on every render would restart playback from scratch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, last, persona]);

  const canPause = speech.status === "playing" || speech.status === "paused";
  // Ticker is visible only while there's something actually playing/paused —
  // hidden through retrieval + TTS fetch (before playback starts) and again
  // once the audio ends (status goes back to "idle"), rather than lingering
  // on the last spoken line.
  const words =
    canPause && last?.role === "assistant"
      ? stripMarkdownForSpeech(last.content)
          .split(/\s+/)
          .filter(Boolean)
          // Em dashes stripped from the displayed text (not filtered out as
          // whole tokens) — activeIndex is the server's index into this same
          // tokenisation (see supabase/functions/speak), so removing a token
          // here instead of just blanking it would shift every later word
          // out of sync with playback.
          .map((w) => w.replace(/—/g, ""))
      : [];

  const [configIssue] = useState(() => !CHAT_FN_URL || !SUPABASE_ANON_KEY || !persona);
  const loading = isLoading || speech.status === "loading";
  const micDisabled = isLoading || configIssue;

  // Push-to-talk: hold spacebar to record, release to send — same start/
  // stop RingMicButton's own click uses (see its imperative handle above).
  // Only fires when nothing interactive is focused (activeElement is the
  // body): otherwise a keyboard user who has tabbed to a numeral, audio
  // toggle, pause, or the mic button would trigger recording instead of
  // activating that control with Space. Also ignored while the mic is
  // disabled (loading/misconfigured), matching the button's own state.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || micDisabled) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      e.preventDefault();
      micRef.current?.start();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      micRef.current?.stop();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [micDisabled]);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 px-6 sm:bottom-28">
        <NowPlayingStrip words={words} activeIndex={speech.activeWordIndex} />
      </div>
      {/* Transport control for the narration — same row as the ticker, out
        at the screen edge so it never crowds the centered scrolling text.
        Only shown once there's something to pause/resume. */}
      {canPause && (
        <button
          type="button"
          onClick={() =>
            speech.status === "playing" ? speech.pause() : speech.resume()
          }
          title={speech.status === "playing" ? "Pause" : "Resume"}
          aria-label={speech.status === "playing" ? "Pause narration" : "Resume narration"}
          className="pointer-events-auto absolute bottom-28 right-6 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#E3DAC6] transition-colors hover:border-[color:var(--accent)]/50 hover:text-[color:var(--accent)]"
        >
          {speech.status === "playing" ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}
      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto absolute inset-x-0 bottom-16 z-10 mx-auto flex w-full max-w-md items-center px-6 sm:bottom-8"
      >
        <div className="relative min-w-0 flex-1">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={`Ask ${figure.first} anything…`}
            aria-label={`Ask ${figure.first} anything`}
            disabled={isLoading || configIssue}
            autoComplete="off"
            className="w-full rounded-full border border-white/20 bg-white/[0.04] py-2.5 pl-4 pr-11 text-sm text-[#E3DAC6] placeholder:text-[#8A7F68] focus-visible:border-[color:var(--accent)]/50"
          />
          {/* Loading spinner sits left of the mic button, inside the same
            pill, rather than at the far edge — the mic now occupies that
            spot (see RingMicButton's own absolute positioning). */}
          {loading && (
            <span
              className="pointer-events-none absolute right-10 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border border-current border-t-transparent text-[#9A8E74]"
              aria-hidden
            />
          )}
          <RingMicButton
            ref={micRef}
            disabled={micDisabled}
            onResult={(text) => void append({ role: "user", content: text })}
          />
        </div>
      </form>
    </>
  );
}

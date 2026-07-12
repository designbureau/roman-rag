import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";

function FullscreenIcon() {
  return (
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
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function SoundIcon() {
  return (
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
      <polygon points="4,9 8,9 12,5 12,19 8,15 4,15" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a9 9 0 0 1 0 12" />
    </svg>
  );
}

function MicIcon() {
  return (
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
  );
}

// One row of the "for the best experience" checklist — a toggle where the
// state is genuinely a toggle (fullscreen, sound), or a one-shot prompt
// where it isn't (the browser's mic permission can be requested but not
// un-requested from script, so "blocked" is a dead end, not an off state).
function PromptRow({
  icon,
  label,
  state,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  state: "on" | "off" | "blocked";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "blocked"}
      className={`flex items-center gap-2 whitespace-nowrap border px-3 py-1.5 text-left text-[11px] uppercase tracking-[0.1em] transition-colors disabled:cursor-default ${
        state === "on"
          ? "border-[color:var(--accent)]/50 text-[color:var(--accent)]"
          : state === "blocked"
            ? "border-white/10 text-[#5F5849]"
            : "border-white/10 text-[#E3DAC6] hover:border-[color:var(--accent)]/50 hover:text-[color:var(--accent)]"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {state === "on" && <span aria-hidden>✓</span>}
    </button>
  );
}

// Shown once, over the ring's first paint. Two phases: while the busts'
// GLBs and shared stone textures are still fetching (a genuinely heavy
// load, tens of MB combined), it's just the wordmark and a progress bar;
// once ready, it turns into a short "best experience" checklist —
// fullscreen, sound, mic permission — with an explicit Enter button, rather
// than auto-dismissing straight into the ring. Progress is read from
// three.js's global LoadingManager via drei's useProgress (a store keyed to
// that manager, not to any one component's Suspense boundary), since this
// overlay sits outside the Canvas entirely.
export function GalleryLoadingScreen({
  soundOn,
  onToggleSound,
  onEnter,
}: {
  soundOn: boolean;
  onToggleSound: () => void;
  /** Fires the instant "Enter the Exedra" is clicked (not after the 500ms
   *  fade-out completes) — lets the ring's own entrance sequence
   *  (gallery.tsx) start revealing underneath while this overlay is still
   *  fading away, instead of waiting for it to fully disappear first. */
  onEnter?: () => void;
}) {
  const { active, progress } = useProgress();
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Guards the brief window on mount where nothing has been requested yet
  // and `active` is still momentarily false — without it, that instant
  // would read as "loading finished" and skip straight to the checklist.
  const startedRef = useRef(false);

  useEffect(() => {
    if (active) startedRef.current = true;
    if (startedRef.current && !active && progress >= 100) setReady(true);
  }, [active, progress]);

  // Backstop: if the loading manager never reports activity (e.g. every
  // asset was already warm in the browser cache and the load/progress
  // events fire faster than React can observe "active" go true), don't
  // leave the archive gated behind a progress bar that never completes.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const [fullscreen, setFullscreen] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenElement,
  );
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      // Sandboxed/embedded previews (no "fullscreen" permissions policy)
      // reject this silently — a progressive enhancement, not something
      // worth surfacing an error for.
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const [micState, setMicState] = useState<"idle" | "requesting" | "granted" | "blocked">(
    "idle",
  );
  const requestMic = () => {
    if (micState === "granted" || micState === "requesting") return;
    setMicState("requesting");
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Only warming the permission grant for RingMicButton's later use —
        // don't hold the input device open until then.
        stream.getTracks().forEach((t) => t.stop());
        setMicState("granted");
      })
      .catch(() => setMicState("blocked"));
  };

  const handleEnter = () => {
    setFading(true);
    onEnter?.();
    setTimeout(() => setDismissed(true), 500);
  };

  if (dismissed) return null;

  return (
    <div
      className={`pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-12 overflow-hidden bg-black px-6 text-center transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Marcus Aurelius — a captured still of the ring's own bust render
        (see gallery-ring.tsx), not a stock photo. Kept dim: this is a black
        loading screen with a faint figure in it, not a photo background.
        Sits between the watermark (behind it) and everything else (in
        front of it) in z-space — see the two z-indexes below. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] bg-cover bg-center opacity-[0.52]"
        style={{ backgroundImage: "url(/images/marcus-loading-bg.jpg)" }}
      />
      {/* No z-index on this wrapper or the one below it — either would
        start a new stacking context and trap the watermark inside it,
        forcing it back above the bust image as a side effect of being
        above the title. Un-indexed `position: relative` wrappers don't do
        that, so the watermark's z-0 and the title's z-10 both escape to
        compare directly against the image's z-5 above, while still
        physically sharing this wrapper's centering with the title —
        keeping the two aligned. */}
      <div>
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden
            className="font-display pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[13vw] uppercase text-[color:var(--accent)] opacity-20"
            style={{ letterSpacing: "0.08em" }}
          >
            Voces Romae
          </div>
          <div
            className="font-display relative z-10 text-6xl uppercase text-white sm:text-8xl"
            style={{ letterSpacing: "0.14em", textShadow: "0 2px 16px rgba(0,0,0,0.9)" }}
          >
            Voices of Rome
          </div>
        </div>
        {/* font-display (not font-corpus) — .living-gallery overrides
          .font-corpus to sans-serif for the chat message bubbles that reuse
          it (see living-gallery.css), which isn't what we want here; the
          gallery's own serif is font-display (Cormorant Garamond), matching
          the title above. */}
        <div
          className="font-display relative z-10 mx-auto mt-6 max-w-md text-base uppercase text-[#9A8E74]"
          style={{ letterSpacing: "0.05em", lineHeight: 1.7 }}
        >
          Conversations with ancient Roman figures, grounded in the words they left behind.
        </div>
        {/* Both loading-phase and ready-phase blocks stay mounted the whole
          time and only ever cross-fade via opacity — conditionally
          mounting/unmounting them (the previous `{!ready && ...}` /
          `{ready && ...}` pattern) removed/added flex children, which
          reflowed and visibly jumped everything else in this centered
          column the instant loading finished. `pointer-events-none` and
          `aria-hidden` keep the faded-out phase inert rather than merely
          invisible. */}
        <div
          aria-hidden={ready}
          className={`relative z-10 mx-auto mt-7 h-px w-40 overflow-hidden bg-white/10 transition-opacity duration-300 ${
            ready ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div
            className="h-full bg-[color:var(--accent)] transition-[width] duration-200 ease-out"
            style={{ width: `${Math.min(100, Math.round(progress))}%` }}
          />
        </div>
        <div
          aria-hidden={ready}
          className={`relative z-10 font-mono mt-3 text-[11px] tracking-[0.04em] text-[#9A8E74] transition-opacity duration-300 ${
            ready ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {Math.min(100, Math.round(progress))}%
        </div>
      </div>

      <div
        aria-hidden={!ready}
        className={`relative z-10 flex flex-col items-center gap-4 transition-opacity duration-300 ${
          ready ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#C9BFA8]">
          For the best experience
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <PromptRow
            icon={<FullscreenIcon />}
            label="Full screen"
            state={fullscreen ? "on" : "off"}
            onClick={toggleFullscreen}
          />
          <PromptRow
            icon={<SoundIcon />}
            label="Sound"
            state={soundOn ? "on" : "off"}
            onClick={onToggleSound}
          />
          <PromptRow
            icon={<MicIcon />}
            label={
              micState === "granted"
                ? "Microphone enabled"
                : micState === "blocked"
                  ? "Microphone blocked"
                  : micState === "requesting"
                    ? "Requesting…"
                    : "Enable microphone"
            }
            state={micState === "granted" ? "on" : micState === "blocked" ? "blocked" : "off"}
            onClick={requestMic}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handleEnter}
        tabIndex={ready ? 0 : -1}
        aria-hidden={!ready}
        className={`relative z-10 border border-[color:var(--accent)]/60 px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-[color:var(--accent)] transition-colors hover:bg-[color:var(--accent)]/10 ${
          ready ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        Enter the Exedra
      </button>
    </div>
  );
}

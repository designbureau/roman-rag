import { useEffect, useRef } from "react";

// Ambient loop for the gallery ring — a single persistent <audio> created
// lazily on first enable and reused for the component's lifetime (rather
// than a new Audio() per toggle), so pausing/resuming doesn't restart the
// track from 0. Renders nothing; purely an effect.
export function BackgroundMusic({ enabled }: { enabled: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio("/sounds/music.mp3");
      audio.loop = true;
      audio.volume = 0.25;
      audioRef.current = audio;
    }
    if (enabled) {
      void audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return null;
}

// Builds a smooth, seamlessly-repeating sine-like wave as an SVG path: a
// run of `periods` identical up-hump/down-hump cycles, `periodWidth` units
// wide each, so a container clipped to less than the full run can loop a
// translateX animation by exactly one periodWidth with no visible seam.
function wavePath(
  periods: number,
  periodWidth: number,
  amplitude: number,
  midY: number,
  startX: number,
): string {
  let d = `M${startX} ${midY}`;
  for (let i = 0; i < periods; i++) {
    const x0 = startX + i * periodWidth;
    const half = periodWidth / 2;
    d += ` C${x0 + half * 0.33} ${midY - amplitude}, ${x0 + half * 0.67} ${midY - amplitude}, ${x0 + half} ${midY}`;
    d += ` C${x0 + half * 1.33} ${midY + amplitude}, ${x0 + half * 1.67} ${midY + amplitude}, ${x0 + periodWidth} ${midY}`;
  }
  return d;
}

// One period wide (matches the lg-wave-scroll keyframe's translateX, so the
// loop point is invisible) — see wavePath above.
const WAVE_PERIOD = 12;
const MUSIC_WAVE_D = wavePath(4, WAVE_PERIOD, 5, 12, -WAVE_PERIOD);

// A continuously flowing sine wave — translates left by exactly one period
// on a loop while music is on (a real traveling wave, not a pulse/flash);
// sits static and dim when muted.
function MusicIcon({ animate }: { animate: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ overflow: "hidden" }}
    >
      <path
        d={MUSIC_WAVE_D}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          animation: animate ? `lg-wave-scroll 1.2s linear infinite` : undefined,
          opacity: animate ? undefined : 0.4,
        }}
      />
    </svg>
  );
}

// Speaker with two sound-wave arcs that pulse outward on a staggered loop
// while effects are on; fixed at a low, unequal opacity (still legible as
// "muted speaker") when off.
function SfxIcon({ animate }: { animate: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="4,9 8,9 12,5 12,19 8,15 4,15" fill="currentColor" stroke="none" />
      <path
        d="M15.5 8.5a5 5 0 0 1 0 7"
        style={{
          animation: animate ? "lg-wave-pulse 1.4s ease-in-out infinite" : undefined,
          opacity: animate ? undefined : 0.3,
        }}
      />
      <path
        d="M18.5 6a9 9 0 0 1 0 12"
        style={{
          animation: animate ? "lg-wave-pulse 1.4s ease-in-out 0.25s infinite" : undefined,
          opacity: animate ? undefined : 0.15,
        }}
      />
    </svg>
  );
}

// Plain circled-"i" glyph — matches the music/SFX icons' stroke weight and
// 16x16 footprint so all three read as one icon set.
export function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

// No circle/border chrome — just the icon, color-toggled. Small fixed hit
// area (not visible) keeps the click target reasonable despite the tiny
// glyph.
function ControlButton({
  on,
  onClick,
  label,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className={`inline-flex h-7 w-7 items-center justify-center transition-colors ${
        on ? "text-[color:var(--accent)]" : "text-[#9A8E74] hover:text-[#E3DAC6]"
      }`}
    >
      {children}
    </button>
  );
}

// Two plain-icon toggles — music (ambient loop, see BackgroundMusic above)
// and sound effects (the ring-rotation clunk in gallery-ring.tsx). Same
// top-6 row as the numeral filmstrip (gallery.tsx) so the two read as one
// header line. State lives in the parent (GalleryRoute) since both this
// button row and gallery-ring.tsx's SFX gate need to read it, and
// BackgroundMusic needs the music half.
export function AudioControls({
  musicOn,
  onToggleMusic,
  sfxOn,
  onToggleSfx,
  children,
}: {
  musicOn: boolean;
  onToggleMusic: () => void;
  sfxOn: boolean;
  onToggleSfx: () => void;
  /** Extra icons sharing this row — e.g. the About link (gallery.tsx). */
  children?: React.ReactNode;
}) {
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-4 sm:left-auto sm:right-6 sm:top-6 sm:translate-x-0 sm:gap-3">
      <ControlButton
        on={musicOn}
        onClick={onToggleMusic}
        label={musicOn ? "Mute music" : "Play music"}
      >
        <MusicIcon animate={musicOn} />
      </ControlButton>
      <ControlButton
        on={sfxOn}
        onClick={onToggleSfx}
        label={sfxOn ? "Mute sound effects" : "Enable sound effects"}
      >
        <SfxIcon animate={sfxOn} />
      </ControlButton>
      {children}
    </div>
  );
}

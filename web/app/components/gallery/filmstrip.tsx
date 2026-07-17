import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import type { GalleryFigure } from "~/data/gallery-figures";
import { prefersReducedMotion } from "~/lib/reduced-motion";

// Same per-letter GSAP reveal as StaggerText (gallery.tsx) and the speech
// ticker (ring-chat.tsx), but gated on `revealed` flipping true instead of
// firing unconditionally on mount — the ring's intro sequence mounts every
// numeral at once and reveals them left to right over time, so each one
// needs to stay invisible until its own turn rather than animating in
// immediately. Letters are held at opacity 0 via inline style ONLY while
// hidden; once revealed the style stops touching opacity at all
// (`undefined`, not 0/1), handing the property fully over to GSAP's direct
// DOM writes so a later unrelated re-render (e.g. `active` changing color)
// can't stomp the animated/settled value. `useLayoutEffect` (fires before
// paint) is what makes that handoff invisible instead of a one-frame flash.
function RevealNumeral({
  text,
  ariaLabel,
  active,
  revealed,
  compact,
  onSelect,
}: {
  text: string;
  ariaLabel: string;
  active: boolean;
  revealed: boolean;
  compact: boolean;
  onSelect: () => void;
}) {
  const lettersRef = useRef<Array<HTMLSpanElement | null>>([]);
  const firedRef = useRef(false);

  useLayoutEffect(() => {
    if (!revealed || firedRef.current) return;
    firedRef.current = true;
    // Under reduced motion the inline `opacity: revealed ? undefined : 0`
    // already makes the letters visible once revealed; skip the tween.
    if (prefersReducedMotion()) return;
    const letters = lettersRef.current.filter((el): el is HTMLSpanElement => el !== null);
    if (!letters.length) return;
    gsap.fromTo(
      letters,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", stagger: 0.04 },
    );
  }, [revealed]);

  return (
    <button
      onClick={onSelect}
      aria-label={ariaLabel}
      aria-current={active ? "true" : undefined}
      className={
        compact
          ? "font-display px-2 py-1 text-sm font-semibold transition-colors sm:px-3"
          : "font-display px-4 py-2 text-base font-semibold transition-colors"
      }
      style={{
        color: active ? "var(--accent)" : "#ffffff",
        letterSpacing: "0.06em",
        pointerEvents: revealed ? "auto" : "none",
      }}
    >
      {/* The button's aria-label ("View Cicero") is the accessible name,
        so these per-letter spans are only ever read visually. */}
      {text.split("").map((ch, i) => (
        <span
          key={i}
          ref={(el) => {
            lettersRef.current[i] = el;
          }}
          className="inline-block"
          style={{ opacity: revealed ? undefined : 0 }}
        >
          {ch}
        </span>
      ))}
    </button>
  );
}

export function Filmstrip({
  figures,
  activeId,
  onSelect,
  label,
  compact,
  revealedCount,
  skipReveal,
}: {
  figures: GalleryFigure[];
  activeId: string;
  onSelect: (i: number) => void;
  /** Button text per figure. Defaults to the figure's first name (the
   *  single-figure stage's nav); the ring nav passes a Roman numeral instead. */
  label?: (figure: GalleryFigure, index: number) => string;
  /** Tighter padding/no top border, for the ring nav — it floats directly
   *  over the 3D canvas rather than sitting below it in normal flow, so it
   *  needs to stay short enough that raising the name caption above it
   *  (see gallery.tsx) doesn't push into the tallest ring bust's chin. */
  compact?: boolean;
  /** When set, numerals reveal left to right (index < revealedCount) via
   *  RevealNumeral's letter stagger instead of all showing at once —
   *  opt-in, used only by the ring's intro sequence (gallery.tsx); every
   *  other call site omits this and keeps the old plain-button rendering. */
  revealedCount?: number;
  /** Bypasses the reveal animation once the intro has already played once —
   *  the ring nav unmounts/remounts every time the user leaves and returns
   *  to gallery mode, and without this every return trip would replay the
   *  stagger from scratch. */
  skipReveal?: boolean;
}) {
  const animated = revealedCount !== undefined && !skipReveal;
  return (
    <nav
      aria-label="Figures"
      className={
        compact
          ? // pointer-events-auto + w-fit mx-auto (instead of the full-width
            // flex row justify-center relies on) against the parent's
            // pointer-events-none (see gallery.tsx) — that parent spans the
            // full top-6 row so other absolutely-positioned siblings at the
            // same row (AudioControls) can still be reached; a full-width
            // row here, even one only visibly occupied in the center,
            // would otherwise sit on top of them across its whole
            // transparent width and swallow their hover/clicks.
            // Centred at both breakpoints: on mobile the numerals are their
            // own row at the bottom (below the chat) rather than sharing the
            // top header with the audio icons, so there's nothing to sit
            // clear of any more.
            "pointer-events-auto mx-auto flex w-fit flex-nowrap items-center gap-3 sm:gap-4"
          : "flex flex-shrink-0 flex-nowrap items-center justify-center gap-2.5 px-11 pb-5 pt-4.5"
      }
    >
      {figures.map((f, i) => {
        const active = f.id === activeId;
        const text = label ? label(f, i) : f.first;
        if (animated) {
          return (
            <RevealNumeral
              key={f.id}
              text={text}
              ariaLabel={`View ${f.name}`}
              active={active}
              revealed={i < (revealedCount ?? 0)}
              compact={!!compact}
              onSelect={() => onSelect(i)}
            />
          );
        }
        return (
          <button
            key={f.id}
            onClick={() => onSelect(i)}
            aria-label={`View ${f.name}`}
            aria-current={active ? "true" : undefined}
            className={
              compact
                ? "font-display px-2 py-1 text-sm font-semibold transition-colors sm:px-3"
                : "font-display px-4 py-2 text-base font-semibold transition-colors"
            }
            // .font-display sets its own tight -0.022em letter-spacing, which
            // beats the (removed) tracking-wide utility class via Tailwind's
            // cascade layers — overridden inline instead, matching the
            // wider tracking used for the figure name and ticker text.
            style={{
              color: active ? "var(--accent)" : "#ffffff",
              letterSpacing: "0.06em",
            }}
          >
            {text}
          </button>
        );
      })}
    </nav>
  );
}

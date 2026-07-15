import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Link } from "react-router";
import type { Route } from "./+types/gallery";
import "~/styles/living-gallery.css";
import { GALLERY_FIGURES } from "~/data/gallery-figures";
import { GalleryRing } from "~/components/gallery/gallery-ring";
import { FigureStage } from "~/components/gallery/figure-stage";
import { AskPanel } from "~/components/gallery/ask-panel";
import { LiveAskPanel } from "~/components/gallery/live-ask-panel";
import { Filmstrip } from "~/components/gallery/filmstrip";
import { RingChat } from "~/components/gallery/ring-chat";
import { AudioControls, BackgroundMusic, InfoIcon } from "~/components/gallery/audio-controls";
import { CustomCursor } from "~/components/gallery/custom-cursor";
import { GalleryLoadingScreen } from "~/components/gallery/loading-screen";
import { GalleryTuningProvider } from "~/components/gallery/tuning-context";
import { Button } from "~/components/ui/button";
import { prefersReducedMotion } from "~/lib/reduced-motion";

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossOrigin: "anonymous" as const,
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Archivo:wght@400;500;600;700&display=swap",
    },
  ];
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Voces Romae" },
    {
      name: "description",
      content:
        "A dim hall of Roman busts, rendered in 3D — ask one a question, and it speaks.",
    },
  ];
}

type Mode = "gallery" | "figure";

// GALLERY_FIGURES is ordered chronologically by birth year (oldest first —
// see its file comment), so the ring nav's numeral is just the array
// position.
const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V"];

const MUSIC_STORAGE_KEY = "gallery-music-on";
const SFX_STORAGE_KEY = "gallery-sfx-on";

// Pacing for the ring's intro reveal (see the introStarted effect below):
// each numeral+bust pair starts RING_STEP_MS after the previous one (they
// overlap mid-animation rather than waiting for each to finish, which reads
// as a cascade rather than a slideshow); the name/date caption, then the
// icon row, then the chat input each wait a further beat after the previous
// step starts, so they land once the ring itself has mostly settled instead
// of piling in at the same instant.
const RING_STEP_MS = 320;
const NAME_DELAY_MS = 250;
const ICONS_DELAY_MS = 250;
const CHAT_DELAY_MS = 200;

// Same letter-by-letter GSAP reveal as the ring's speech ticker (see
// NowPlayingStrip in ring-chat.tsx) — here it just fires once, on mount,
// since the whole caption remounts per figure already (key={`name-${id}`}
// at the call site below) rather than needing to track an active index.
function StaggerText({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const lettersRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    // Under reduced motion the letters are left in their natural
    // (already-visible) state — no slide/fade tween.
    if (prefersReducedMotion()) return;
    const letters = lettersRef.current.filter((el): el is HTMLSpanElement => el !== null);
    if (!letters.length) return;
    gsap.fromTo(
      letters,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", stagger: 0.025 },
    );
  }, [text]);

  return (
    <span className={className} style={style}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          ref={(el) => {
            lettersRef.current[i] = el;
          }}
          className="inline-block"
          style={ch === " " ? { whiteSpace: "pre" } : undefined}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

export default function GalleryRoute() {
  const [mode, setMode] = useState<Mode>("gallery");
  const [carousel, setCarousel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  // Both default on; both remembered per-browser so an explicit mute
  // choice sticks across visits.
  const [musicOn, setMusicOn] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(MUSIC_STORAGE_KEY) !== "false";
  });
  const [sfxOn, setSfxOn] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(SFX_STORAGE_KEY) !== "false";
  });
  const toggleMusic = () =>
    setMusicOn((v) => {
      window.localStorage.setItem(MUSIC_STORAGE_KEY, String(!v));
      return !v;
    });
  const toggleSfx = () =>
    setSfxOn((v) => {
      window.localStorage.setItem(SFX_STORAGE_KEY, String(!v));
      return !v;
    });
  // The loading screen's single "Sound" prompt sets both together, rather
  // than exposing music/SFX separately the way the persistent top-right
  // controls do — a first-run checklist item, not the fine-grained mixer.
  const toggleSound = () => {
    const on = !(musicOn && sfxOn);
    window.localStorage.setItem(MUSIC_STORAGE_KEY, String(on));
    window.localStorage.setItem(SFX_STORAGE_KEY, String(on));
    setMusicOn(on);
    setSfxOn(on);
  };

  // Entrance sequence for the ring's own UI, kicked off the instant the
  // loading screen's "Enter" is clicked (see onEnter on GalleryLoadingScreen
  // below) rather than waiting for its fade-out to finish — so the ring is
  // already mid-reveal by the time the loading screen is gone. introDone
  // latches permanently true once the sequence has played through once;
  // GalleryRing/Filmstrip use it to skip re-animating on every later
  // gallery-mode remount (leaving mode and coming back).
  const [introStarted, setIntroStarted] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [nameRevealed, setNameRevealed] = useState(false);
  const [chatRevealed, setChatRevealed] = useState(false);

  useEffect(() => {
    if (!introStarted) return;
    // Reduced motion: no staggered cascade. Reveal the whole ring, nav,
    // icons, and chat at once so nothing animates in.
    if (prefersReducedMotion()) {
      setRevealedCount(GALLERY_FIGURES.length);
      setNameRevealed(true);
      setChatRevealed(true);
      setIntroDone(true);
      return;
    }
    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    void (async () => {
      for (let i = 0; i < GALLERY_FIGURES.length; i++) {
        if (cancelled) return;
        setRevealedCount(i + 1);
        await wait(RING_STEP_MS);
      }
      if (cancelled) return;
      await wait(NAME_DELAY_MS);
      if (cancelled) return;
      setNameRevealed(true);
      // The audio controls are no longer part of the reveal cascade (they
      // render immediately for WCAG 1.4.2); this beat now just spaces the
      // chat input after the name.
      await wait(ICONS_DELAY_MS + CHAT_DELAY_MS);
      if (cancelled) return;
      setChatRevealed(true);
      setIntroDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [introStarted]);

  // carousel is always kept in [0, GALLERY_FIGURES.length) by the handlers
  // below (modulo arithmetic in the ring's drag/click handlers).
  const figure = GALLERY_FIGURES[carousel]!;

  const enter = (i: number) => {
    setCarousel(i);
    setMode("figure");
  };
  const back = () => setMode("gallery");
  const switchFigure = (i: number) => setCarousel(i);

  // Arrow-key navigation through the figures — same step the ring's own
  // drag/numeral-click handlers use. Ignored while typing in the chat
  // input (arrow keys move the text cursor there instead). Escape backs
  // out of the single-figure stage view to the ring — a no-op (and not
  // gated on typing focus) when already there.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) =>
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMode("gallery");
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      const n = GALLERY_FIGURES.length;
      setCarousel((c) => (e.key === "ArrowLeft" ? (c - 1 + n) % n : (c + 1) % n));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <GalleryTuningProvider figures={GALLERY_FIGURES}>
      <div
        className="living-gallery relative h-screen w-screen overflow-hidden text-[color:var(--foreground)]"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% -8%, rgba(201,168,106,0.16), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.6), transparent 55%), #14120E",
        }}
      >
        <CustomCursor />
        {mode === "gallery" && (
          // Solid black backdrop, not the shared warm-gold page gradient
          // above (still used behind the stage view) — the ring's own
          // canvas is transparent (see gallery-ring.tsx), so without this
          // the gradient would bleed through at the letterboxed edges.
          <main className="relative h-full w-full bg-black">
            {/* The gallery is otherwise headingless (the visual title lives
              in the loading screen); this gives assistive tech a document
              title and the route an h1. */}
            <h1 className="sr-only">Voices of Rome</h1>
            {/* Screen-reader narration of the ring: the WebGL busts convey
              nothing to AT on their own, so this polite live region
              announces the centred figure whenever the carousel moves. */}
            <p aria-live="polite" className="sr-only">
              {figure.name}, {figure.years}
            </p>
            {/* Explicit z-0: this is a full-bleed WebGL canvas (see
              gallery-ring.tsx), and every overlay below is given z-10 so
              stacking is guaranteed rather than relying on DOM order among
              same-stack-level positioned siblings — that implicit ordering
              made the canvas the topmost hit-target for anything not
              covered by an overlay's own hitbox (e.g. tools outside this
              app that pick a DOM element under the cursor to annotate).
              role="img" + aria-label give the otherwise-opaque canvas a
              text alternative naming who is on screen and how to move. */}
            <div
              className="absolute inset-0 z-0"
              role="img"
              aria-label={`${figure.name}, ${figure.years}. A ring of five Roman busts; ${figure.first} is centred. Use the numbered buttons above or the left and right arrow keys to move between figures.`}
            >
              <GalleryRing
                figures={GALLERY_FIGURES}
                carousel={carousel}
                onSetCarousel={setCarousel}
                onEnter={enter}
                enterDisabled
                sfxOn={sfxOn}
                revealedCount={revealedCount}
                skipReveal={introDone}
              />
            </div>
            <BackgroundMusic enabled={musicOn} />
            {/* Music/SFX toggles, top-right — the dev-only Leva tuning panel
              (tuning-context.tsx) also docks there, but it's hidden for now
              (see that file); revisit placement together if it comes back.
              Rendered immediately (not gated behind the intro reveal): music
              can start playing the moment the gallery is entered, so its
              mute must be visible and operable from that instant rather than
              a few seconds later when the reveal cascade finishes (WCAG
              1.4.2 Audio Control). */}
            <div>
              <AudioControls
                musicOn={musicOn}
                onToggleMusic={toggleMusic}
                sfxOn={sfxOn}
                onToggleSfx={toggleSfx}
              >
                {/* Cross-link to the rest of the site, now that the ring is the
                  landing page — shares this row with the music/SFX icons
                  instead of its own bottom-right nav. */}
                <Link
                  to="/papers"
                  title="About"
                  aria-label="About"
                  className="inline-flex h-7 w-7 items-center justify-center text-[#9A8E74] transition-colors hover:text-[#E3DAC6]"
                >
                  <InfoIcon />
                </Link>
              </AudioControls>
            </div>
            {/* Roman-numeral nav, chronological order (see ROMAN_NUMERALS) —
              jumps the ring to that figure without entering the single-figure
              stage, same as clicking a flanking bust. Top-center.
              pointer-events-none — full-width so the numerals center, but
              that leaves empty transparent space on either side of them
              overlapping AudioControls at the same row; Filmstrip's own
              compact row re-enables pointer-events-auto on just itself. */}
            <div className="pointer-events-none absolute inset-x-0 top-6 z-10">
              <Filmstrip
                figures={GALLERY_FIGURES}
                activeId={figure.id}
                onSelect={setCarousel}
                label={(_, i) => ROMAN_NUMERALS[i]}
                compact
                revealedCount={revealedCount}
                skipReveal={introDone}
              />
            </div>
            {/* Overlaid on the full-screen canvas, not sharing layout space with
              it — pointer-events-none so it never steals the ring's drag/click.
              Gated on nameRevealed (see introStarted effect above) so the
              very first caption waits for the busts to finish their own
              reveal instead of fading up immediately on mount; nameRevealed
              never goes false again afterward, so every later figure switch
              still fades this in right away via the key={`name-${id}`}
              remount below, same as before the intro sequence existed. */}
            {nameRevealed && (
              <div
                className="fade-up pointer-events-none absolute inset-x-0 top-24 z-10 text-center"
                key={`name-${figure.id}`}
              >
                {/* Bust height/framing varies per figure (see gallery-figures.ts
                  ring placements), so the tallest hair/headwear can reach up
                  into this caption's space. A shadow keeps the text legible
                  against pale stone instead of just the dark backdrop. */}
                {/* pointer-events-auto against the parent's pointer-events-none —
                  that parent spans the full width so drag/click still passes
                  through to the ring on either side of the text, but without
                  this override the "none" would inherit onto these divs too,
                  making the caption itself unclickable/unselectable. w-fit
                  mx-auto (instead of relying on the parent's text-center)
                  shrinks each div to its own text instead of the full row, so
                  pointer-events-auto only claims the glyphs themselves. */}
                <StaggerText
                  text={figure.name}
                  className="pointer-events-auto mx-auto block w-fit font-display text-2xl font-semibold uppercase text-[#E7DECC]"
                  // .font-display sets its own tight -0.022em letter-spacing,
                  // which beats the (removed) tracking-wide utility class via
                  // Tailwind's cascade layers — overridden inline instead, same
                  // as the ticker text in ring-chat.tsx.
                  style={{ textShadow: "0 2px 16px rgba(0,0,0,0.9)", letterSpacing: "0.06em" }}
                />
                <StaggerText
                  text={figure.years}
                  className="pointer-events-auto mx-auto mt-1.5 block w-fit text-[11px] uppercase tracking-[0.18em] text-[#A4874D]"
                  style={{ textShadow: "0 1px 10px rgba(0,0,0,0.9)" }}
                />
              </div>
            )}
            {/* Last step of the intro sequence — see introStarted effect
              above. A plain, unstyled wrapper: RingChat positions its own
              pieces (ticker, pause button, form) with `absolute`, which
              still resolves against the nearest positioned ancestor further
              up the tree, so this div doesn't need `position` itself. */}
            <div
              className={`transition-opacity duration-500 ${
                chatRevealed ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <RingChat figure={figure} key={`chat-${figure.id}`} />
            </div>
            <GalleryLoadingScreen
              soundOn={musicOn && sfxOn}
              onToggleSound={toggleSound}
              onEnter={() => setIntroStarted(true)}
            />
          </main>
        )}

        {mode === "figure" && (
          <main className="flex h-full w-full flex-col">
            <div
              className="grid min-h-0 flex-1 gap-x-12 overflow-hidden px-14 pb-6 pt-3"
              style={{ gridTemplateColumns: "7fr 5fr" }}
            >
              <div className="flex h-full min-h-0 flex-col items-center overflow-hidden pb-2">
                <div className="relative w-full min-h-0 flex-1">
                  <FigureStage figure={figure} speaking={speaking} />
                </div>
                <div className="flex flex-shrink-0 flex-col text-center">
                  <h2 className="font-display mt-2 text-[40px] font-bold uppercase tracking-wide leading-none">
                    {figure.name}
                  </h2>
                  <div className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                    {figure.title} · {figure.years}
                  </div>
                  <div className="font-display mx-auto mt-2 max-w-[320px] text-[17px] italic text-[#9A8E74]">
                    {figure.epithet}
                  </div>
                  {/* Always rendered (invisible when absent) so the text block's
                    height is constant across figures — otherwise the canvas
                    above it (flex-1) gets a different amount of space per
                    figure and can end up sized before a credit line's late
                    reflow, clipping the bust against overflow-hidden. */}
                  <div
                    className="mx-auto mt-3 max-w-[300px] text-[10px] leading-relaxed text-[#8A7F68]"
                    style={{ visibility: figure.credit ? "visible" : "hidden" }}
                  >
                    {figure.credit || "placeholder"}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col pt-1.5">
                {figure.personaKey ? (
                  <LiveAskPanel
                    key={figure.id}
                    figure={figure}
                    onSpeakingChange={setSpeaking}
                  />
                ) : (
                  <AskPanel
                    key={figure.id}
                    figure={figure}
                    onSpeakingChange={setSpeaking}
                  />
                )}
              </div>
            </div>

            <div className="relative flex-shrink-0">
              {/* Overlaid on Filmstrip's own centered row rather than a flex
                sibling — Filmstrip centers its numerals across the full
                width, so a normal flex item here would push them off-center
                instead of sharing the bar. */}
              <Button
                variant="ghost"
                onClick={back}
                className="absolute left-11 top-1/2 h-auto -translate-y-1/2 gap-1.5 px-0 text-xs font-semibold uppercase tracking-[0.14em] text-[#9A8E74] hover:bg-transparent hover:text-[color:var(--accent)]"
              >
                ‹ Gallery
              </Button>
              <Filmstrip
                figures={GALLERY_FIGURES}
                activeId={figure.id}
                onSelect={switchFigure}
                label={(_, i) => ROMAN_NUMERALS[i]}
              />
            </div>
          </main>
        )}
      </div>
    </GalleryTuningProvider>
  );
}

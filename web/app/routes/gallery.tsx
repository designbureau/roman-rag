import { useEffect, useState } from "react";
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
import { GalleryTuningProvider } from "~/components/gallery/tuning-context";
import { Button } from "~/components/ui/button";

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
    { title: "The Roman Archive" },
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
        {mode === "gallery" && (
          // Solid black backdrop, not the shared warm-gold page gradient
          // above (still used behind the stage view) — the ring's own
          // canvas is transparent (see gallery-ring.tsx), so without this
          // the gradient would bleed through at the letterboxed edges.
          <div className="relative h-full w-full bg-black">
            {/* Explicit z-0: this is a full-bleed WebGL canvas (see
              gallery-ring.tsx), and every overlay below is given z-10 so
              stacking is guaranteed rather than relying on DOM order among
              same-stack-level positioned siblings — that implicit ordering
              made the canvas the topmost hit-target for anything not
              covered by an overlay's own hitbox (e.g. tools outside this
              app that pick a DOM element under the cursor to annotate). */}
            <div className="absolute inset-0 z-0">
              <GalleryRing
                figures={GALLERY_FIGURES}
                carousel={carousel}
                onSetCarousel={setCarousel}
                onEnter={enter}
                enterDisabled
                sfxOn={sfxOn}
              />
            </div>
            <BackgroundMusic enabled={musicOn} />
            {/* Music/SFX toggles, top-right — the dev-only Leva tuning panel
              (tuning-context.tsx) also docks there, but it's hidden for now
              (see that file); revisit placement together if it comes back. */}
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
              />
            </div>
            {/* Overlaid on the full-screen canvas, not sharing layout space with
              it — pointer-events-none so it never steals the ring's drag/click. */}
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
              <div
                className="pointer-events-auto mx-auto w-fit font-display text-2xl font-semibold uppercase text-[#E7DECC]"
                // .font-display sets its own tight -0.022em letter-spacing,
                // which beats the (removed) tracking-wide utility class via
                // Tailwind's cascade layers — overridden inline instead, same
                // as the ticker text in ring-chat.tsx.
                style={{ textShadow: "0 2px 16px rgba(0,0,0,0.9)", letterSpacing: "0.06em" }}
              >
                {figure.name}
              </div>
              <div
                className="pointer-events-auto mx-auto mt-1.5 w-fit text-[11px] uppercase tracking-[0.18em] text-[#A4874D]"
                style={{ textShadow: "0 1px 10px rgba(0,0,0,0.9)" }}
              >
                {figure.years}
              </div>
            </div>
            <RingChat figure={figure} key={`chat-${figure.id}`} />
          </div>
        )}

        {mode === "figure" && (
          <div className="flex h-full w-full flex-col">
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
                    className="mx-auto mt-3 max-w-[300px] text-[10px] leading-relaxed text-[#5F5849]"
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
          </div>
        )}
      </div>
    </GalleryTuningProvider>
  );
}

import type { GalleryFigure } from "~/data/gallery-figures";

export function Filmstrip({
  figures,
  activeId,
  onSelect,
  label,
  compact,
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
}) {
  return (
    <div
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
            "pointer-events-auto mx-auto flex w-fit flex-nowrap items-center gap-2"
          : "flex flex-shrink-0 flex-nowrap items-center justify-center gap-2.5 px-11 pb-5 pt-4.5"
      }
    >
      {figures.map((f, i) => {
        const active = f.id === activeId;
        return (
          <button
            key={f.id}
            onClick={() => onSelect(i)}
            className={
              compact
                ? "font-display px-3 py-1 text-sm font-semibold transition-colors"
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
            {label ? label(f, i) : f.first}
          </button>
        );
      })}
    </div>
  );
}

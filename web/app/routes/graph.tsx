import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { SiteNav } from "~/components/site-nav";
import { hierarchy, pack } from "d3-hierarchy";
import graphData from "~/data/topics-graph.json";
import { askAboutTerm } from "~/lib/natural-ask";

// Tableau10 — the categorical palette from the D3 bubble-chart example.
const PALETTE = [
  "#4e79a7",
  "#f28e2c",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc949",
  "#af7aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ab",
];

type RawNode = {
  id: string;
  count: number;
  sources: Record<string, number>;
};

type GraphPayload = {
  generated_at: string;
  top_n: number;
  min_edge_weight: number;
  nodes: RawNode[];
  edges: unknown[];
};

// The datum that flows through the d3-hierarchy pack layout. The synthetic
// root carries `children`; each leaf carries a topic.
interface BubbleDatum {
  id?: string;
  count?: number;
  sources?: Record<string, number>;
  children?: BubbleDatum[];
}

const data = graphData as GraphPayload;

// Square canvas, like the D3 example. MARGIN keeps the outer circles from
// clipping against the edge.
const SIZE = 932;
const MARGIN = 2;

export function meta() {
  return [{ title: "Theme bubbles — The Roman Archive" }];
}

export default function Graph() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  // Circle-pack the topics into the viewport, sized by story count. This is
  // a static layout — no physics — so it lands the same way every load.
  const bubbles = useMemo(() => {
    const root = hierarchy<BubbleDatum>({ children: data.nodes })
      .sum((d) => d.count ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const packed = pack<BubbleDatum>()
      .size([SIZE - MARGIN * 2, SIZE - MARGIN * 2])
      .padding(3)(root);

    return packed.leaves().map((leaf, i) => ({
      id: leaf.data.id!,
      count: leaf.data.count ?? 0,
      x: leaf.x,
      y: leaf.y,
      r: leaf.r,
      color: PALETTE[i % PALETTE.length],
      // Break the term across lines so it wraps inside the circle.
      words: leaf.data.id!.split(/\s+/).filter(Boolean),
    }));
  }, []);

  const onBubbleClick = (id: string) => {
    navigate(`/?ask=${encodeURIComponent(askAboutTerm(id))}`);
  };

  const empty = data.nodes.length === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <header className="mb-4">
        <h1 className="font-display text-5xl">Theme bubbles</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted-foreground)]">
          The most-frequent themes in the corpus, each sized by how many
          letters touch on it. Hover for the count; click a bubble to ask the
          chat about that theme.
        </p>
      </header>

      <SiteNav />

      {empty ? (
        <p className="rounded-md border border-dashed border-[color:var(--border)] p-6 text-sm text-[color:var(--muted-foreground)]">
          Thematic analytics will appear once the full corpus is ingested and
          theme-tagged. The current slice is the Letters to Atticus
          (<em>ad Atticum</em>) only.
        </p>
      ) : (
      <>
      <div className="relative rounded-md border border-[color:var(--border)] bg-[color:var(--background)]">
        {hovered && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-[color:var(--foreground)] px-2 py-1 text-xs text-[color:var(--background)]">
            {hovered}
            <span className="opacity-70">
              {" · "}
              {bubbles.find((b) => b.id === hovered)?.count} letters
            </span>
          </div>
        )}
        <svg
          viewBox={`${-MARGIN} ${-MARGIN} ${SIZE} ${SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          textAnchor="middle"
          className="block w-full select-none"
          style={{ aspectRatio: "1 / 1" }}
        >
          {bubbles.map((b, i) => {
            const active = hovered === b.id;
            const dim = hovered !== null && !active;
            const clipId = `bubble-clip-${i}`;
            return (
              <g
                key={b.id}
                transform={`translate(${b.x}, ${b.y})`}
                opacity={dim ? 0.3 : 1}
                onMouseEnter={() => setHovered(b.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onBubbleClick(b.id)}
                style={{ cursor: "pointer" }}
                className="transition-opacity"
              >
                <title>
                  {b.id} · {b.count} letters
                </title>
                <clipPath id={clipId}>
                  <circle r={b.r} />
                </clipPath>
                <circle
                  r={b.r}
                  fill={b.color}
                  fillOpacity={active ? 0.85 : 0.7}
                  stroke={active ? "currentColor" : "none"}
                  strokeWidth={1.5}
                  className="text-[color:var(--foreground)]"
                />
                {/* Label wrapped inside the circle, with the count below it,
                    clipped so nothing spills past the edge. */}
                <text
                  clipPath={`url(#${clipId})`}
                  fontSize={11}
                  fill="currentColor"
                  pointerEvents="none"
                  className="font-corpus text-[color:var(--foreground)]"
                >
                  {b.words.map((w, wi) => (
                    <tspan
                      key={wi}
                      x={0}
                      y={`${wi - b.words.length / 2 + 0.35}em`}
                    >
                      {w}
                    </tspan>
                  ))}
                  <tspan x={0} y={`${b.words.length / 2 + 0.35}em`} fillOpacity={0.7}>
                    {b.count}
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <footer className="mt-6 text-xs text-[color:var(--muted-foreground)]">
        Generated {data.generated_at.slice(0, 10)} over the corpus. Bubble size
        scales with how often each theme appears across the correspondence.
        Hover for the count, click to ask. Source: Cicero, Letters to Atticus
        (<em>ad Atticum</em>), via the Perseus Digital Library.
      </footer>
      </>
      )}
    </main>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { SiteNav } from "~/components/site-nav";
import heatmapData from "~/data/topics-heatmap.json";
import { askAboutTerm, askInformantAboutTerm } from "~/lib/natural-ask";

type InformantHeader = { id: string; count: number };
type HeatmapTerm = {
  term: string;
  count: number;
  byInformant: Record<string, number>;
};
type HeatmapPayload = {
  generated_at: string;
  total_stories: number;
  informants: InformantHeader[];
  terms: HeatmapTerm[];
};

const data = heatmapData as HeatmapPayload;

export function meta() {
  return [{ title: "Topic × informant — Bleek-Lloyd Archive" }];
}

export default function Heatmap() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"count" | "alpha">("count");

  // Normalisation toggle:
  //  - "raw":     opacity scales to the global max cell (any informant, any term)
  //  - "row":     opacity scales within each row (who told this story most)
  //  - "column":  opacity scales within each informant column (signature topics)
  const [norm, setNorm] = useState<"raw" | "row" | "column">("raw");

  const { rows, opacityFor } = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let rows = q ? data.terms.filter((t) => t.term.includes(q)) : data.terms.slice();
    if (sort === "alpha") rows = [...rows].sort((a, b) => a.term.localeCompare(b.term));

    let globalMax = 1;
    const rowMaxes = new Map<string, number>();
    const colMaxes = new Map<string, number>();
    for (const t of rows) {
      let rmax = 1;
      for (const i of data.informants) {
        const v = t.byInformant[i.id] ?? 0;
        if (v > rmax) rmax = v;
        if (v > globalMax) globalMax = v;
        const cmax = colMaxes.get(i.id) ?? 1;
        if (v > cmax) colMaxes.set(i.id, v);
      }
      rowMaxes.set(t.term, rmax);
    }

    // Log scaling against the chosen scope's max — gives small counts
    // visible weight while still differentiating the giants.
    const scale = (count: number, max: number) => {
      if (count <= 0 || max <= 0) return 0;
      return Math.log2(count + 1) / Math.log2(max + 1);
    };
    const opacityFor = (term: HeatmapTerm, informantId: string) => {
      const v = term.byInformant[informantId] ?? 0;
      if (v === 0) return 0;
      const max =
        norm === "row"
          ? (rowMaxes.get(term.term) ?? 1)
          : norm === "column"
            ? (colMaxes.get(informantId) ?? 1)
            : globalMax;
      return scale(v, max);
    };

    return { rows, opacityFor };
  }, [filter, sort, norm]);

  const onTermClick = (term: string) =>
    navigate(`/?ask=${encodeURIComponent(askAboutTerm(term))}`);
  const onCellClick = (term: string, informant: string) =>
    navigate(`/?ask=${encodeURIComponent(askInformantAboutTerm(informant, term))}`);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <header className="mb-4">
        <h1 className="font-display text-5xl">Topic × informant</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted-foreground)]">
          Each row is a recurring DBLC head term; each column is one of
          the named |xam contributors. Cell intensity scales with how
          many of that informant's stories carry that tag — the
          signature of each voice in the archive.
        </p>
      </header>

      <SiteNav />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] p-3 text-sm">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter terms…"
          className="flex-1 min-w-[12rem] rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1"
        />
        <label className="flex items-center gap-2">
          <span className="text-[color:var(--muted-foreground)]">Sort</span>
          <select
            className="rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1"
            value={sort}
            onChange={(e) => setSort(e.target.value as "count" | "alpha")}
          >
            <option value="count">by frequency</option>
            <option value="alpha">alphabetical</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[color:var(--muted-foreground)]">Shade by</span>
          <select
            className="rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1"
            value={norm}
            onChange={(e) => setNorm(e.target.value as typeof norm)}
            title="raw: absolute cell counts · row: who owns each topic · column: each informant's signature topics"
          >
            <option value="raw">raw counts</option>
            <option value="row">row (who owns each topic)</option>
            <option value="column">column (signature topics)</option>
          </select>
        </label>
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {rows.length} terms shown
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-[color:var(--border)] bg-[color:var(--background)]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[color:var(--background)]">
            <tr className="border-b border-[color:var(--border)]">
              <th className="px-3 py-2 text-left font-medium text-[color:var(--muted-foreground)]">
                term
              </th>
              <th className="px-2 py-2 text-right font-medium text-[color:var(--muted-foreground)]">
                stories
              </th>
              {data.informants.map((i) => (
                <th
                  key={i.id}
                  className="px-2 py-2 text-center font-medium text-[color:var(--muted-foreground)]"
                  title={`${i.count} tagged stories from ${i.id}`}
                >
                  <div className="font-corpus text-sm">{i.id}</div>
                  <div className="text-xs opacity-60">{i.count}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.term}
                className="border-b border-[color:var(--border)] last:border-b-0"
              >
                <td className="px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => onTermClick(t.term)}
                    className="font-corpus text-base hover:underline"
                  >
                    {t.term}
                  </button>
                </td>
                <td className="px-2 py-1.5 text-right text-xs text-[color:var(--muted-foreground)]">
                  {t.count}
                </td>
                {data.informants.map((i) => {
                  const v = t.byInformant[i.id] ?? 0;
                  const o = opacityFor(t, i.id);
                  return (
                    <td
                      key={i.id}
                      className="relative p-0 text-center"
                      title={`${v} of ${i.id}'s stories — click to ask`}
                    >
                      <button
                        type="button"
                        onClick={() => v > 0 && onCellClick(t.term, i.id)}
                        disabled={v === 0}
                        className="block h-9 w-full text-xs font-medium tabular-nums text-[color:var(--foreground)] transition-colors hover:ring-1 hover:ring-[color:var(--accent)] hover:ring-inset disabled:cursor-default"
                        style={{
                          backgroundColor:
                            v > 0
                              ? `color-mix(in srgb, var(--accent) ${(o * 100).toFixed(1)}%, transparent)`
                              : "transparent",
                        }}
                      >
                        {v > 0 ? v : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={data.informants.length + 2} className="px-3 py-4 text-sm text-[color:var(--muted-foreground)]">
                  No terms match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="mt-6 text-xs text-[color:var(--muted-foreground)]">
        Generated {data.generated_at.slice(0, 10)} from <code>data/stories.json</code>.
        Click a term to ask about it; click a cell to ask what that informant
        said about it. Top {data.terms.length} head terms shown — extend{" "}
        <code>HEATMAP_TOP_TERMS</code> in <code>build.ts</code> to widen.
      </footer>
    </main>
  );
}

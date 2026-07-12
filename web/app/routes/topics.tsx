import { useMemo, useState } from "react";
import { Link } from "react-router";
import { SiteNav } from "~/components/site-nav";
import topicsData from "~/data/topics.json";
import { askAboutTerm } from "~/lib/natural-ask";

type Topic = {
  term: string;
  count: number;
  sources: Record<string, number>;
};

type TopicsPayload = {
  generated_at: string;
  total_stories: number;
  total_terms: number;
  terms: Topic[];
};

const data = topicsData as TopicsPayload;

const SOURCE_LABELS: Record<string, string> = {
  "ad-atticum": "Letters to Atticus (ad Atticum)",
};

export function meta() {
  return [{ title: "Themes — The Roman Archive" }];
}

export default function Topics() {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"count" | "alpha">("count");

  const { rows, max, min } = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let rows = q
      ? data.terms.filter((t) => t.term.includes(q))
      : data.terms;
    if (sort === "alpha") {
      rows = [...rows].sort((a, b) => a.term.localeCompare(b.term));
    }
    let max = 0;
    let min = Infinity;
    for (const r of rows) {
      if (r.count > max) max = r.count;
      if (r.count < min) min = r.count;
    }
    return { rows, max, min: min === Infinity ? 0 : min };
  }, [filter, sort]);

  // Log-scale font size between MIN_REM and MAX_REM. log2 keeps the
  // difference between 2 and 228 visually legible without making the
  // top terms balloon to header-size.
  const MIN_REM = 0.85;
  const MAX_REM = 1.9;
  const logMax = Math.log2(Math.max(max, 2));
  const logMin = Math.log2(Math.max(min, 2));
  const span = logMax - logMin || 1;
  const sizeFor = (count: number) => {
    const t = (Math.log2(Math.max(count, 2)) - logMin) / span;
    return MIN_REM + t * (MAX_REM - MIN_REM);
  };

  const empty = data.terms.length === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <header className="mb-6">
        <h1 className="font-display text-5xl">Themes</h1>
        <p className="mt-2 max-w-xl text-sm text-[color:var(--muted-foreground)]">
          Recurring themes drawn from Cicero's correspondence. Click a theme
          to ask about it.
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
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] p-3 text-sm">
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
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {rows.length} shown
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 leading-tight">
        {rows.map((t) => {
          const breakdown = Object.entries(t.sources)
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => `${SOURCE_LABELS[s] ?? s}: ${n}`)
            .join(" · ");
          return (
            <Link
              key={t.term}
              to={`/chat?ask=${encodeURIComponent(askAboutTerm(t.term))}`}
              title={`${t.count} letters — ${breakdown}`}
              className="font-corpus text-[color:var(--foreground)] hover:underline focus-visible:outline-none focus-visible:underline"
              style={{ fontSize: `${sizeFor(t.count)}rem` }}
            >
              {t.term}
              <span className="ml-1 text-xs text-[color:var(--muted-foreground)]">
                {t.count}
              </span>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <p className="text-sm text-[color:var(--muted-foreground)]">
            No themes match.
          </p>
        )}
      </div>

      <footer className="mt-12 border-t border-[color:var(--border)] pt-6 text-xs text-[color:var(--muted-foreground)]">
        Theme index built over the corpus. Source: Cicero, Letters to Atticus
        (<em>ad Atticum</em>), Latin ed. Tyrrell–Purser, Eng. trans.
        Shuckburgh, via the Perseus Digital Library. Last refreshed{" "}
        {data.generated_at.slice(0, 10)}.
      </footer>
      </>
      )}
    </main>
  );
}

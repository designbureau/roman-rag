import { useMemo, useState } from "react";
import { Link } from "react-router";
import { SiteNav } from "~/components/site-nav";
import libraryData from "~/data/library.json";

type Entry = {
  id: string;
  title: string;
  informant: string | null;
  cicero_ref: string | null;
  snippet: string;
  source_url: string;
  sub_group?: string;
  year: number | null;
  date_label: string | null;
  source_id?: string;
  source_label?: string;
};
type Section = {
  id: string;
  label: string;
  count: number;
  entries: Entry[];
};
type LibraryPayload = {
  generated_at: string;
  total_stories: number;
  sections: Section[];
};

const data = libraryData as LibraryPayload;

// All book sections open by default — the corpus is currently one
// collection (the Letters to Atticus), grouped into its sixteen books.
const DEFAULT_COLLAPSED = new Set<string>();

export function meta() {
  return [{ title: "Library — The Roman Archive" }];
}

function readPrompt(title: string): string {
  return `read me "${title}"`;
}

export default function Library() {
  const [filter, setFilter] = useState("");
  const [groupBy, setGroupBy] = useState<"source" | "year">("source");
  const [open, setOpen] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const sec of data.sections) if (!DEFAULT_COLLAPSED.has(sec.id)) s.add(sec.id);
    return s;
  });

  // Annotate every entry with its source id/label so flat (year-grouped)
  // displays can still show provenance.
  const allEntries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const sec of data.sections) {
      for (const e of sec.entries) {
        out.push({ ...e, source_id: sec.id, source_label: sec.label });
      }
    }
    return out;
  }, []);

  const sections = useMemo<Section[]>(() => {
    const q = filter.trim().toLowerCase();
    const matches = (e: Entry) =>
      !q ||
      e.title.toLowerCase().includes(q) ||
      (e.informant ?? "").toLowerCase().includes(q) ||
      e.snippet.toLowerCase().includes(q);

    if (groupBy === "source") {
      const filtered = data.sections
        .map((sec) => {
          const entries = sec.entries
            .filter(matches)
            .map((e) => ({ ...e, source_id: sec.id, source_label: sec.label }));
          return { ...sec, entries, count: entries.length };
        })
        .filter((sec) => sec.entries.length > 0);
      return filtered;
    }

    // Year mode: flatten + bucket by year. Unknown-year entries land in
    // an "Undated" bucket sorted last.
    const buckets = new Map<string, Entry[]>();
    for (const e of allEntries) {
      if (!matches(e)) continue;
      const key = e.year !== null ? String(e.year) : "Undated";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(e);
    }
    const out: Section[] = [];
    const keys = [...buckets.keys()].sort((a, b) => {
      if (a === "Undated") return 1;
      if (b === "Undated") return -1;
      return parseInt(a, 10) - parseInt(b, 10);
    });
    for (const k of keys) {
      const entries = buckets.get(k)!.slice().sort((a, b) => {
        const sa = a.source_label ?? "";
        const sb = b.source_label ?? "";
        if (sa !== sb) return sa.localeCompare(sb);
        return a.title.localeCompare(b.title);
      });
      out.push({ id: `year-${k}`, label: k, entries, count: entries.length });
    }
    return out;
  }, [filter, groupBy, allEntries]);

  // When filtering, expose all matched sections. In year mode, default
  // all sections collapsed (22 years collapse to a scannable list).
  const isOpen = (id: string) => {
    if (filter.trim().length > 0) return true;
    if (groupBy === "year") return open.has(id);
    return open.has(id);
  };
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalShown = sections.reduce((n, s) => n + s.entries.length, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <header className="mb-4">
        <h1 className="font-display text-5xl">Library</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted-foreground)]">
          All {data.total_stories} letters in the archive — Cicero's
          correspondence to Atticus, in its sixteen books. Click a letter to
          ask the chat to read it; the external link goes to Perseus.
        </p>
      </header>

      <SiteNav />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] p-3 text-sm">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter title, reference, or text…"
          className="flex-1 min-w-[14rem] rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1"
        />
        <label className="flex items-center gap-2">
          <span className="text-[color:var(--muted-foreground)]">Group by</span>
          <select
            className="rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "source" | "year")}
          >
            <option value="source">book</option>
            <option value="year">year (chronological)</option>
          </select>
        </label>
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {totalShown} {totalShown === 1 ? "letter" : "letters"} shown
        </span>
      </div>

      <div className="space-y-4">
        {sections.map((sec) => {
          const opened = isOpen(sec.id);
          return (
            <section
              key={sec.id}
              className="overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--background)]"
            >
              <button
                type="button"
                onClick={() => toggle(sec.id)}
                className="flex w-full items-baseline gap-2 border-b border-[color:var(--border)] px-4 py-3 text-left hover:bg-[color:var(--muted)]"
              >
                <span aria-hidden className="inline-block w-4 text-[color:var(--muted-foreground)]">
                  {opened ? "▾" : "▸"}
                </span>
                <h2 className="font-corpus text-lg">{sec.label}</h2>
                <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">
                  {sec.entries.length}{" "}
                  {sec.entries.length === 1 ? "letter" : "letters"}
                </span>
              </button>
              {opened && <SectionEntries entries={sec.entries} groupBy={groupBy} />}
            </section>
          );
        })}
        {sections.length === 0 && (
          <p className="rounded-md border border-dashed border-[color:var(--border)] p-6 text-sm text-[color:var(--muted-foreground)]">
            No letters match.
          </p>
        )}
      </div>

      <footer className="mt-6 text-xs text-[color:var(--muted-foreground)]">
        Generated {data.generated_at.slice(0, 10)} from the corpus
        (<code>stories</code>).
      </footer>
    </main>
  );
}

function SectionEntries({
  entries,
  groupBy,
}: {
  entries: Entry[];
  groupBy: "source" | "year";
}) {
  // Sub-grouping (DBLC notebook collections) only makes sense in source
  // mode — in year mode we have entries from many sources mixed together
  // and notebook-collection labels would be misleading.
  const groups = useMemo(() => {
    if (groupBy === "year") return [{ label: null, entries }];
    const out: Array<{ label: string | null; entries: Entry[] }> = [];
    let current: { label: string | null; entries: Entry[] } | null = null;
    for (const e of entries) {
      const label = e.sub_group ?? null;
      if (!current || current.label !== label) {
        current = { label, entries: [] };
        out.push(current);
      }
      current.entries.push(e);
    }
    return out;
  }, [entries, groupBy]);

  return (
    <ul className="divide-y divide-[color:var(--border)]">
      {groups.map((g, i) => (
        <li key={i}>
          {g.label && (
            <h3 className="bg-[color:var(--muted)]/40 px-4 py-1.5 text-xs uppercase tracking-wide text-[color:var(--muted-foreground)]">
              {g.label} · {g.entries.length}
            </h3>
          )}
          <ul className="divide-y divide-[color:var(--border)]/60">
            {g.entries.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    to={`/?ask=${encodeURIComponent(readPrompt(e.title))}`}
                    className="font-corpus text-base hover:underline"
                  >
                    {e.title}
                  </Link>
                  <a
                    href={e.source_url}
                    target="_blank"
                    rel="noreferrer"
                    title="View on Perseus"
                    className="shrink-0 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:underline"
                  >
                    source ↗
                  </a>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[color:var(--muted-foreground)]">
                  {groupBy === "year" && e.source_label && (
                    <span>{e.source_label}</span>
                  )}
                  {e.informant && (
                    <span>{groupBy === "year" ? "· " : ""}{e.informant}</span>
                  )}
                  {e.date_label && groupBy === "year" && (
                    <span>· {e.date_label}</span>
                  )}
                  {e.cicero_ref && (
                    <span className="font-mono text-[0.7rem]">
                      · {e.cicero_ref}
                    </span>
                  )}
                </div>
                {e.snippet && (
                  <p className="mt-1 line-clamp-2 text-sm text-[color:var(--muted-foreground)]">
                    {e.snippet}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

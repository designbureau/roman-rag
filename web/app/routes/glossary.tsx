import { useMemo, useState } from "react";
import { Link } from "react-router";
import { SiteNav } from "~/components/site-nav";
import glossaryData from "~/data/glossary.json";

type Entry = {
  term: string;
  glosses: string[];
  occurrences: number;
  sources: string[];
  mantis_friends_gloss?: string;
  bleek_1956_gloss?: string;
};

type GlossaryPayload = {
  generated_at: string;
  total_terms: number;
  terms: Entry[];
};

const data = glossaryData as GlossaryPayload;

// The Latin glossary is built from the corpus itself. Restrict to terms
// drawn from the current sources so stray or untagged entries don't leak
// in before the fuller lemma-based glossing pass is run.
const CORPUS_SOURCES = new Set([
  "ad-atticum",
]);
const corpusTerms = data.terms.filter((t) =>
  t.sources.some((s) => CORPUS_SOURCES.has(s)),
);

export function meta() {
  return [{ title: "Glossary — Voces Romae" }];
}

// Sort key: lowercased, punctuation-stripped, so alphabetical ordering
// ignores leading marks. Harmless for Latin lemmata; retained so the
// ordering stays stable across scripts.
function sortKey(term: string): string {
  return term.replace(/[ǀǁǃǂ|!]/g, "").toLowerCase();
}

function firstLetter(term: string): string {
  const k = sortKey(term);
  return k[0]?.toUpperCase() ?? "—";
}

export default function Glossary() {
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? corpusTerms.filter(
          (t) =>
            t.term.toLowerCase().includes(q) ||
            t.glosses.some((g) => g.toLowerCase().includes(q)),
        )
      : corpusTerms;
    return list;
  }, [filter]);

  // Group by first letter (of click-stripped form) for the section bands.
  const grouped = useMemo(() => {
    const out: Array<{ letter: string; entries: Entry[] }> = [];
    let current: { letter: string; entries: Entry[] } | null = null;
    for (const e of rows) {
      const L = firstLetter(e.term);
      if (!current || current.letter !== L) {
        current = { letter: L, entries: [] };
        out.push(current);
      }
      current.entries.push(e);
    }
    return out;
  }, [rows]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <header className="mb-4">
        <h1 className="font-display text-5xl">Glossary</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted-foreground)]">
          Latin terms mined from the corpus itself — names, offices, and
          recurring vocabulary from the correspondence. Click a term to ask
          the chat what it means.
        </p>
      </header>

      <SiteNav />

      {corpusTerms.length === 0 && (
        <p className="mt-4 rounded-md border border-dashed border-[color:var(--border)] p-6 text-sm text-[color:var(--muted-foreground)]">
          The Latin glossary will appear once the full corpus is ingested and
          lemma-tagged. The current slice is the Letters to Atticus
          (<em>ad Atticum</em>) only.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] p-3 text-sm">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter terms or glosses…"
          className="flex-1 min-w-[14rem] rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1"
        />
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {rows.length} {rows.length === 1 ? "term" : "terms"} shown
        </span>
      </div>

      <div className="space-y-6">
        {grouped.map((g) => (
          <section key={g.letter}>
            <h2 className="mb-2 label-mono">{g.letter}</h2>
            <ul className="divide-y divide-[color:var(--border)] rounded-md border border-[color:var(--border)] bg-[color:var(--background)]">
              {g.entries.map((e) => {
                const mfOnly =
                  e.mantis_friends_gloss && e.sources.length === 1 &&
                  e.sources[0] === "mantis-friends-1924";
                const bleekOnly =
                  e.bleek_1956_gloss && e.sources.length === 1 &&
                  e.sources[0] === "bleek-1956";
                const badge = mfOnly
                  ? "M&F 1924"
                  : bleekOnly
                    ? "Bleek 1956"
                    : `×${e.occurrences}`;
                return (
                  <li key={e.term} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        to={`/?ask=${encodeURIComponent(`what is "${e.term}"`)}`}
                        className="font-corpus text-lg hover:underline"
                      >
                        {e.term}
                      </Link>
                      <span className="font-mono text-[0.7rem] text-[color:var(--muted-foreground)]">
                        {badge}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {e.glosses.map((gl, i) => {
                        const tag =
                          e.mantis_friends_gloss === gl && !mfOnly
                            ? "[M&F 1924]"
                            : e.bleek_1956_gloss === gl && !bleekOnly
                              ? "[Bleek 1956]"
                              : null;
                        return (
                          <Link
                            key={i}
                            to={`/?ask=${encodeURIComponent(`tell me about ${gl}`)}`}
                            className="block text-sm text-[color:var(--foreground)] hover:underline"
                          >
                            {gl}
                            {tag && (
                              <span className="ml-2 font-mono text-[0.65rem] text-[color:var(--muted-foreground)]">
                                {tag}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed border-[color:var(--border)] p-6 text-sm text-[color:var(--muted-foreground)]">
            No terms match.
          </p>
        )}
      </div>

      <footer className="mt-8 space-y-2 text-xs text-[color:var(--muted-foreground)]">
        <p>
          Glosses are harvested from the corpus and may be imperfect — the
          same Latin word can carry several senses depending on context, and
          the English is that of the public-domain translation. Multiple
          glosses are kept where they recur.
        </p>
        <p>
          Source: Cicero, Letters to Atticus (<em>ad Atticum</em>), Latin ed.
          R.Y. Tyrrell &amp; L.C. Purser, English translation E.S.
          Shuckburgh, via the Perseus Digital Library. A fuller lemma-based
          glossary will follow once the wider corpus is ingested.
        </p>
      </footer>
    </main>
  );
}

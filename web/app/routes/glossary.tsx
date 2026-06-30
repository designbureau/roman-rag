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

// Show only terms mined from the |xam texts themselves (the corpus's
// own glosses, the 1924 Mantis & Friends appendix, the DBLC
// indexed-under structure). Dorothea Bleek's 1956 *Bushman Dictionary*
// entries are withheld: that dictionary spans 27 languages and dialects
// with no per-entry language tag, and our OCR of it mangles the click
// consonants and diacritics (e.g. "ǁkabba" → "ilkabba"). Surfacing it
// as |xam vocabulary would mislead anyone trying to learn words —
// flagged by Pippa Skotnes, June 2026. It can return once properly
// transcribed and language-tagged. See docs/skotnes-feedback-remediation.md.
const CORPUS_SOURCES = new Set([
  "dblc-stories",
  "mantis-friends-1924",
  "specimens-1911",
]);
const xamTerms = data.terms.filter((t) =>
  t.sources.some((s) => CORPUS_SOURCES.has(s)),
);

export function meta() {
  return [{ title: "Glossary — Bleek-Lloyd Archive" }];
}

// Sort key: click-stripped lowercase, so alphabetical ordering ignores
// the leading click consonant. !haken sits with `h`, |kaggen sits with `k`.
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
      ? xamTerms.filter(
          (t) =>
            t.term.toLowerCase().includes(q) ||
            t.glosses.some((g) => g.toLowerCase().includes(q)),
        )
      : xamTerms;
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
          {xamTerms.length} |xam terms mined from the texts themselves:
          the corpus's own parenthetical glosses, Dorothea Bleek's 1924
          <em> Mantis &amp; Friends</em> appendix, and the DBLC
          indexed-under structure. Click a term to ask the chat what it
          means.
        </p>
      </header>

      <SiteNav />

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
          Glosses are harvested from the |xam corpus and may be
          imperfect — Lucy and Wilhelm wrote in 19th-century English, and
          the same |xam word can carry several translations depending on
          context. Multiple glosses are kept where they recur.
        </p>
        <p>
          Dorothea Bleek's 1956 <em>Bushman Dictionary</em> is
          deliberately withheld here. It covers 27 languages and dialects
          with no per-entry language marker, and our optical
          transcription of it corrupts the click consonants and
          diacritics. Presenting it as |xam vocabulary would mislead. It
          can be reinstated once it has been properly transcribed and
          tagged by language.
        </p>
      </footer>
    </main>
  );
}

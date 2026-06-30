/**
 * Cicero — Letters to Atticus (ad Atticum), the ad Atticum vertical slice.
 *
 * Primary source: Perseus `phi0474.phi057` — Purser's Latin (OCT, 1903) and
 * Shuckburgh's English (1908), aligned at WHOLE-LETTER granularity.
 *
 * Why whole-letter: the Latin is keyed book → letter → section, but
 * Shuckburgh's English body divs are keyed only by `(book, letter)`
 * (`n="text=A:book=1:letter=5"`). So we collapse the Latin's sections up to
 * `(book, letter)` and join on the English `(book, letter)`. A case-normalised
 * suffix (`4A` → `4a`) recovers the editorial sub-letters. Validated coverage:
 * ~92.8% of Latin letters (docs/cicero-archive-plan.md §4).
 *
 * Following the "never drop a side" rule, every letter present on EITHER side
 * is ingested; the missing side is left null/empty rather than dropped.
 */
import type { Story } from "@roman/shared";
import { slugify } from "@roman/shared";

import { loadTEI, cleanText, scaifeUrl, type TEI } from "./perseus-tei.js";
import { ATTICUS, discoverEditions, type Editions } from "./work-registry.js";

// Shuckburgh's translation, per phi057's __cts__ provenance. Stamped only when
// an English side is present.
const TRANSLATOR = "Evelyn S. Shuckburgh";

type LatLetter = { full: string; book: string; letterRaw: string };
type EngLetter = { text: string; book: string; letterRaw: string };

/** Letter suffixes differ only in case between editors: `4A` (Purser) ↔ `4a` (Shuckburgh). */
export function normSuffix(letter: string): string {
  return letter.trim().toLowerCase();
}

/** Latin: walk book → letter, collapsing each letter's sections into one passage. */
export function parseLatin($: TEI): Map<string, LatLetter> {
  const out = new Map<string, LatLetter>();
  $('div[subtype="book"]').each((_i, bookEl) => {
    const $book = $(bookEl);
    const book = ($book.attr("n") ?? "").trim();
    if (!book) return;
    $book.children('div[subtype="letter"]').each((_j, letterEl) => {
      const $letter = $(letterEl);
      const letterRaw = ($letter.attr("n") ?? "").trim();
      if (!letterRaw) return;

      // The salute + dateline live in <label rend="opener"> (kept; authentic),
      // the letter text in <div subtype="section"> children.
      const opener = cleanText($letter.children('label[rend="opener"]'));
      const $sections = $letter.children('div[subtype="section"]');
      let body: string;
      if ($sections.length > 0) {
        const parts: string[] = [];
        $sections.each((_k, sec) => {
          const t = cleanText($(sec));
          if (t) parts.push(t);
        });
        body = parts.join("\n\n");
      } else {
        // No section divs — take the letter body directly, minus the opener.
        const $c = $letter.clone();
        $c.find('label[rend="opener"]').remove();
        body = cleanText($c);
      }

      const full = [opener, body].filter((p) => p.length > 0).join("\n\n");
      out.set(`${book}.${normSuffix(letterRaw)}`, { full, book, letterRaw });
    });
  });
  return out;
}

/** English: each `<div type="letter">` keyed by `text=A:book=N:letter=M`. */
export function parseEnglish($: TEI): Map<string, EngLetter> {
  const out = new Map<string, EngLetter>();
  $('div[type="letter"]').each((_i, el) => {
    const n = $(el).attr("n") ?? "";
    const m = /text=A:book=(\w+):letter=(\w+)/.exec(n);
    if (!m || !m[1] || !m[2]) return; // only ad Atticum letters
    const book = m[1];
    const letterRaw = m[2];
    out.set(`${book}.${normSuffix(letterRaw)}`, { text: cleanText($(el)), book, letterRaw });
  });
  return out;
}

/**
 * Pure alignment + Story construction (no I/O — unit-tested directly).
 * Joins on `(book, normalised-letter)`; ingests every letter present on either
 * side. Returns the Stories plus how many had both sides aligned.
 */
export function buildStories(
  lat: Map<string, LatLetter>,
  eng: Map<string, EngLetter>,
  ed: Editions,
): { stories: Story[]; aligned: number } {
  const keys = new Set<string>([...lat.keys(), ...eng.keys()]);
  const stories: Story[] = [];
  let aligned = 0;

  for (const key of keys) {
    const l = lat.get(key);
    const e = eng.get(key);
    if (l && e) aligned += 1;

    const ref = (l ?? e) as LatLetter | EngLetter; // at least one side exists
    const { book, letterRaw } = ref;
    const passage = `${book}.${letterRaw}`;
    const urn = l ? ed.latUrn : ed.engUrn ?? ed.latUrn;

    stories.push({
      id: `${ATTICUS.source}__${slugify(`${book}-${normSuffix(letterRaw)}`)}`,
      source: ATTICUS.source,
      source_url: scaifeUrl(urn, passage),
      title: `Letters to Atticus ${book}.${letterRaw}`,
      informant: ATTICUS.addressee, // addressee
      category: ATTICUS.genre, // genre
      cicero_ref: `${ATTICUS.abbrev} ${book}.${letterRaw}`,
      page_range: null,
      english_text: e?.text ?? "",
      footnotes: null,
      latin_text: l?.full ?? null,
      translator: e ? TRANSLATOR : null,
      edition: ed.latEdition,
      mantis_cycle: false,
      canonical_story_group: null,
    });
  }

  return { stories, aligned };
}

/** Scraper entrypoint registered in ../index.ts as `letters-att`. */
export async function scrapeLettersAtt(): Promise<Story[]> {
  const ed = await discoverEditions(ATTICUS.workDir);
  const lat = parseLatin(await loadTEI(ed.latUrl));
  const eng = ed.engUrl ? parseEnglish(await loadTEI(ed.engUrl)) : new Map<string, EngLetter>();

  const { stories, aligned } = buildStories(lat, eng, ed);
  const cov = lat.size > 0 ? ((100 * aligned) / lat.size).toFixed(1) : "0.0";
  console.log(
    `  ad Atticum: Latin ${lat.size}  English ${eng.size}  aligned ${aligned} (${cov}% of Latin)`,
  );
  return stories;
}

/**
 * Marcus Aurelius — Meditations (Τὰ εἰς ἑαυτόν, "Ad Se Ipsum").
 *
 * English-only ingestion. Perseus (`canonical-greekLit` tlg0562.tlg001) carries
 * the Greek (Leopold, Teubner 1908) but NO English translation, so the
 * parallel-text approach used for Cicero does not apply here. We ingest the
 * public-domain English of **Meric Casaubon (1634, rev. 1635)** from Project
 * Gutenberg #2680 — a clean edition whose own note confirms "the divisions of
 * the text are left unaltered". Casaubon is a loose, sometimes paraphrastic
 * 17th-century rendering; that provenance is stamped on every record and the
 * Classicist voice is candid about it. Latin/Greek original is left null for
 * now (see docs/cicero-archive-plan.md — multi-author expansion).
 *
 * Structure: 12 books ("THE FIRST BOOK" … "THE TWELFTH BOOK"), each divided
 * into Roman-numeral sections ("I.", "II.", …). We parse the region between the
 * first book header and the trailing "NOTES" section, one Story per
 * (book, section) at `Med. B.S` — chunk-sized, since the sections are short.
 */
import type { Story } from "@roman/shared";
import { slugify } from "@roman/shared";

import { fetchCached } from "../cache.js";

const SOURCE = "meditations";
const AUTHOR = "Marcus Aurelius";
const TRANSLATOR = "Meric Casaubon";
const EDITION = "Casaubon, 1634 (rev. 1635); Project Gutenberg #2680";
const GUTENBERG_TXT = "https://www.gutenberg.org/cache/epub/2680/pg2680.txt";
const GUTENBERG_PAGE = "https://www.gutenberg.org/ebooks/2680";

// "THE FIRST BOOK" … "THE TWELFTH BOOK" → 1 … 12.
const ORDINALS = [
  "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH",
  "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH",
];
const ORDINAL_TO_NUM = new Map(ORDINALS.map((w, i) => [w, i + 1]));

const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function romanToInt(s: string): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN_VALUES[s[i]!]!;
    const next = i + 1 < s.length ? ROMAN_VALUES[s[i + 1]!]! : 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

type Section = { book: number; section: number; text: string };

// A section marker is a paragraph that opens with a Roman numeral + ". ".
// Anchoring to paragraph starts (not any line start) excludes name initials
// ("M. Cornelius Fronto…") that wrap to the start of a line mid-prose.
const MARKER_RE = /^([IVXLCDM]+)\.\s+([\s\S]*)$/;

/** Pure parse (no I/O — unit-tested directly). Gutenberg plain text → sections. */
export function parseMeditations(fullText: string): Section[] {
  const text = fullText.replace(/\r\n/g, "\n");

  // Bound to the reading text: from the first book header to the trailing
  // NOTES section (whose entries also use Roman numerals and must be excluded).
  const startIdx = text.search(/^THE FIRST BOOK\s*$/m);
  if (startIdx < 0) throw new Error("meditations: 'THE FIRST BOOK' not found");
  const notesM = /^NOTES\s*$/m.exec(text.slice(startIdx));
  const region = notesM ? text.slice(startIdx, startIdx + notesM.index) : text.slice(startIdx);

  // Split into the twelve books on their ordinal headers.
  const bookRe = /^THE (FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH) BOOK\s*$/gm;
  const heads: { num: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = bookRe.exec(region)) !== null) {
    heads.push({ num: ORDINAL_TO_NUM.get(m[1]!)!, bodyStart: bookRe.lastIndex });
  }

  const out: Section[] = [];
  for (let b = 0; b < heads.length; b++) {
    const body = region.slice(heads[b]!.bodyStart, heads[b + 1]?.bodyStart ?? region.length);
    const paras = body
      .split(/\n[ \t]*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 0);

    // Sections run I, II, III… sequentially. Accept a marker only if its value
    // continues the run (allowing a small gap); the first marker that breaks
    // the sequence — a name initial like "M." (=1000), or an appendix — ends
    // the book, so trailing editorial matter is never ingested.
    let cur: { section: number; parts: string[] } | null = null;
    let next = 1;
    const flush = () => {
      if (cur && cur.parts.length) out.push({ book: heads[b]!.num, section: cur.section, text: cur.parts.join("\n\n") });
    };
    for (const para of paras) {
      const mm = MARKER_RE.exec(para);
      if (mm) {
        const v = romanToInt(mm[1]!);
        if (v >= 1 && v < 100 && v >= next && v <= next + 3) {
          flush();
          cur = { section: v, parts: mm[2]!.trim() ? [mm[2]!.trim()] : [] };
          next = v + 1;
          continue;
        }
        break; // out-of-sequence marker → end of this book's reading text
      }
      if (cur) cur.parts.push(para); // continuation; pre-section matter is skipped
    }
    flush();
  }
  return out;
}

function toStory(s: Section): Story {
  const ref = `${s.book}.${s.section}`;
  return {
    id: `${SOURCE}__${slugify(ref)}`,
    source: SOURCE,
    source_url: GUTENBERG_PAGE,
    title: `Meditations ${ref}`,
    author: AUTHOR,
    is_reference: false,
    informant: null,
    category: "meditation",
    cicero_ref: `Med. ${ref}`,
    page_range: null,
    english_text: s.text,
    footnotes: null,
    latin_text: null,
    translator: TRANSLATOR,
    edition: EDITION,
    mantis_cycle: false,
    canonical_story_group: null,
  };
}

/** Scraper entrypoint registered in ../index.ts as `meditations`. */
export async function scrapeMeditations(): Promise<Story[]> {
  const raw = await fetchCached(GUTENBERG_TXT);
  const sections = parseMeditations(raw);
  const books = new Set(sections.map((s) => s.book));
  console.log(`  Meditations: ${books.size} books, ${sections.length} sections (Casaubon, English-only)`);
  return sections.map(toStory);
}

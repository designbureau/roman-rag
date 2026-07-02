/**
 * Baseline / reference corpus — "A Smaller Dictionary of Greek and Roman
 * Antiquities" (ed. William Smith, 1871). The abridged Smith's: encyclopedic
 * entries on Roman (and some Greek) institutions, religion, law, magistracies,
 * customs, and daily life. Ingested as background material (is_reference =
 * true) — one Story per entry — so it enters retrieval only when the reader
 * turns the "Roman context" toggle on.
 *
 * Source: Project Gutenberg #65909 (plain text). Entries begin with an
 * ALL-CAPS headword at the start of a paragraph, followed by a definition;
 * many entries are bare cross-references ("ADDICTI. [NEXI.]"), which we skip.
 */
import type { Story } from "@roman/shared";
import { slugify } from "@roman/shared";

import { fetchCached } from "../cache.js";

const SOURCE = "smith-antiquities";
const AUTHOR = "Smith's Dictionary";
const EDITION = "William Smith (ed.), A Smaller Dictionary of Greek and Roman Antiquities (1871); Project Gutenberg #65909";
const URL = "https://www.gutenberg.org/cache/epub/65909/pg65909.txt";

// Paragraph-leading headword: a run of ALL-CAPS words (with connectors like
// "or"/"ET"), before the definition punctuation. Uses Unicode uppercase
// (\p{Lu}) because the dictionary marks vowel quantity on headwords with
// macrons/breves — ACCLĀMĀTĬO, ACROĀMA — which ASCII [A-Z] would truncate.
const HEADWORD_RE = /^(\p{Lu}[\p{Lu}’']+(?:[ ](?:or|ET|\p{Lu}[\p{Lu}’']+))*)/u;
/** Strip macrons/breves etc. to a clean ASCII form for ids, refs, and titles. */
function toAscii(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// Front-matter / structural headings that look like headwords but aren't entries.
const STOP = new Set(["EXPLANATION", "PREFACE", "CONTENTS", "INDEX", "LIST", "ABBREVIATIONS", "APPENDIX", "NOTE", "NOTES"]);

function isHeadwordPara(p: string): { headword: string } | null {
  const m = HEADWORD_RE.exec(p);
  if (!m) return null;
  const headword = m[1]!.trim();
  const first = headword.split(/[ ]/)[0]!;
  if (first.length < 3) return null; // too short (initials, "II.")
  if (/^[IVXLCDM]+$/.test(first)) return null; // roman numeral, not a headword
  if (STOP.has(first)) return null;
  return { headword };
}

/** A paragraph whose body is only a bracketed cross-reference — skip it. */
function isCrossRefOnly(p: string, headword: string): boolean {
  const rest = p.slice(headword.length).replace(/^[\s.,:]+/, "");
  return /^\[[^\]]*\][.\s]*$/.test(rest) || rest.length < 40;
}

type Entry = { headword: string; text: string };

export function parseSmith(fullText: string): Entry[] {
  const text = fullText.replace(/\r\n/g, "\n");
  const s = /\*\*\* START OF/.exec(text);
  const e = /\*\*\* END OF/.exec(text);
  const region = text.slice(s ? text.indexOf("\n", s.index) : 0, e ? e.index : undefined);

  const paras = region
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/_([^_]+)_/g, "$1").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  const out: Entry[] = [];
  let cur: Entry | null = null;
  const flush = () => {
    if (cur && cur.text.trim().length >= 40) out.push({ headword: cur.headword, text: cur.text.trim() });
  };
  for (const p of paras) {
    const hw = isHeadwordPara(p);
    if (hw) {
      flush();
      cur = isCrossRefOnly(p, hw.headword) ? null : { headword: hw.headword, text: p };
    } else if (cur) {
      cur.text += "\n\n" + p; // continuation paragraph of the current entry
    }
  }
  flush();
  return out;
}

function titleCase(hw: string): string {
  return hw
    .split(" ")
    .map((w) => (w === "or" || w === "ET" ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

function toStory(entry: Entry): Story {
  const tc = titleCase(toAscii(entry.headword));
  return {
    id: `${SOURCE}__${slugify(toAscii(entry.headword))}`,
    source: SOURCE,
    source_url: "https://www.gutenberg.org/ebooks/65909",
    title: `Smith's Dictionary: ${tc}`,
    author: AUTHOR,
    is_reference: true,
    informant: null,
    category: "reference",
    cicero_ref: `Smith: ${tc}`,
    page_range: null,
    english_text: entry.text,
    footnotes: null,
    latin_text: null,
    translator: null,
    edition: EDITION,
    mantis_cycle: false,
    canonical_story_group: null,
  };
}

/** Scraper entrypoint registered in ../index.ts as `smith-antiquities`. */
export async function scrapeSmith(): Promise<Story[]> {
  const entries = parseSmith(await fetchCached(URL));
  // De-dupe by id (a few headwords recur across letters/volumes).
  const byId = new Map<string, Story>();
  for (const e of entries) {
    const st = toStory(e);
    if (!byId.has(st.id)) byId.set(st.id, st);
  }
  console.log(`  Smith's Dictionary: ${byId.size} entries (reference)`);
  return [...byId.values()];
}

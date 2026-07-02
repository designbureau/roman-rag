/**
 * Baseline / reference corpus — W. Warde Fowler, "Social Life at Rome in the
 * Age of Cicero" (1908). A readable public-domain synthesis of Roman daily
 * life, religion, family, slavery, and society. Ingested as background
 * material (is_reference = true), so it enters retrieval only when the reader
 * turns the "Roman context" toggle on; the bounded figures otherwise speak
 * only from their own words.
 *
 * Source: Project Gutenberg #11256 (plain text). Structure: eleven chapters
 * ("CHAPTER I" … "CHAPTER XI"), each with a short ALL-CAPS title line, running
 * up to the back-matter INDEX. We ingest one Story per chapter; the length
 * guard in the chunker skips the (too-long) whole-chapter chunk and retrieval
 * runs over the per-paragraph chunks.
 */
import type { Story } from "@roman/shared";
import { slugify } from "@roman/shared";

import { fetchCached } from "../cache.js";

const SOURCE = "fowler-social-life";
const AUTHOR = "W. Warde Fowler";
const EDITION = "W. Warde Fowler, Social Life at Rome in the Age of Cicero (1908); Project Gutenberg #11256";
const URL = "https://www.gutenberg.org/cache/epub/11256/pg11256.txt";

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
function romanToInt(s: string): number {
  let t = 0;
  for (let i = 0; i < s.length; i++) {
    const c = ROMAN[s[i]!]!, n = i + 1 < s.length ? ROMAN[s[i + 1]!]! : 0;
    t += c < n ? -c : c;
  }
  return t;
}

/** Join soft-wrapped lines into paragraphs; strip [n] footnote markers. */
function clean(raw: string): string {
  return raw
    .replace(/\[\d+\]/g, "")
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0)
    .join("\n\n");
}

type Chapter = { num: number; title: string; body: string };

export function parseFowler(fullText: string): Chapter[] {
  const text = fullText.replace(/\r\n/g, "\n");
  // The chapter bodies begin at the LAST "CHAPTER I" header — the first such
  // header is the table-of-contents entry (the TOC also contains an "INDEX"
  // line, so bounding on the first INDEX would capture only the TOC).
  const firstMatches = [...text.matchAll(/^CHAPTER I\s*$/gm)];
  const bodyStart = firstMatches.length ? firstMatches[firstMatches.length - 1]!.index! : 0;
  const tail = text.slice(bodyStart);
  // End at the back-matter (INDEX / APPENDIX / FOOTNOTES / Gutenberg footer).
  const endM = /^(?:INDEX|APPENDIX|FOOTNOTES)\s*$|\*\*\* END OF/m.exec(tail);
  const region = endM ? tail.slice(0, endM.index) : tail;

  const re = /^CHAPTER ([IVXL]+)\s*$/gm;
  const marks: { num: number; contentStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(region)) !== null) marks.push({ num: romanToInt(m[1]!), contentStart: re.lastIndex });

  const out: Chapter[] = [];
  for (let i = 0; i < marks.length; i++) {
    const seg = region.slice(marks[i]!.contentStart, marks[i + 1]?.contentStart ?? region.length);
    // Skip the table-of-contents entries (short segments with no real body).
    if (seg.trim().length < 500) continue;
    // First non-empty line is the chapter's ALL-CAPS title.
    const lines = seg.split("\n").map((l) => l.trim());
    const titleIdx = lines.findIndex((l) => l.length > 0);
    const title = titleIdx >= 0 ? lines[titleIdx]! : `Chapter ${marks[i]!.num}`;
    const body = clean(lines.slice(titleIdx + 1).join("\n"));
    if (body) out.push({ num: marks[i]!.num, title, body });
  }
  return out;
}

function toStory(c: Chapter): Story {
  const titleCased = c.title.charAt(0) + c.title.slice(1).toLowerCase();
  return {
    id: `${SOURCE}__${slugify(`ch-${c.num}`)}`,
    source: SOURCE,
    source_url: "https://www.gutenberg.org/ebooks/11256",
    title: `Social Life at Rome — ${c.num}. ${titleCased}`,
    author: AUTHOR,
    is_reference: true,
    informant: null,
    category: "reference",
    cicero_ref: `Fowler ch. ${c.num}`,
    page_range: null,
    english_text: c.body,
    footnotes: null,
    latin_text: null,
    translator: null,
    edition: EDITION,
    mantis_cycle: false,
    canonical_story_group: null,
  };
}

/** Scraper entrypoint registered in ../index.ts as `fowler-social-life`. */
export async function scrapeFowler(): Promise<Story[]> {
  const chapters = parseFowler(await fetchCached(URL));
  console.log(`  Fowler, Social Life at Rome: ${chapters.length} chapters (reference)`);
  return chapters.map(toStory);
}

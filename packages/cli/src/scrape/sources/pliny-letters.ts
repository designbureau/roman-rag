/**
 * Pliny the Younger — Letters (Epistulae). English-only, like the Meditations:
 * William Melmoth's translation (revised by F.C.T. Bosanquet), Project
 * Gutenberg #2811, "Letters of Pliny". This is a SELECTED-letters abridgment
 * — its Roman numerals are this edition's own running sequence, not the
 * standard critical edition's book.letter citation, so refs are cited as
 * "Plin. Ep. N" (this edition's numbering) rather than a fabricated book.letter.
 *
 * The file contains two numbered collections back to back: Pliny's personal
 * letters (I..) and, separately, his correspondence with Trajan (I.. again).
 * The file also opens with a table of contents using the same "N -- To X"
 * marker style as the body, so real entries are distinguished from TOC lines
 * by length (a TOC line is immediately followed by the next marker; a body
 * entry has substantial text after it) — the same class of problem the Fowler
 * scraper solved by locating the LAST duplicate header, generalised here via
 * a length threshold since the TOC and two collections interleave.
 */
import type { Story } from "@roman/shared";
import { slugify } from "@roman/shared";

import { fetchCached } from "../cache.js";

const SOURCE = "pliny-letters";
const AUTHOR = "Pliny the Younger";
const TRANSLATOR = "William Melmoth (rev. F. C. T. Bosanquet)";
const EDITION = "William Melmoth, trans., rev. F. C. T. Bosanquet, Letters of Pliny; Project Gutenberg #2811";
const URL = "https://www.gutenberg.org/cache/epub/2811/pg2811.txt";
const PAGE_URL = "https://www.gutenberg.org/ebooks/2811";

const MIN_BODY_CHARS = 150; // distinguishes a real letter from a TOC line

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function romanToInt(s: string): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN[s[i]!]!, next = i + 1 < s.length ? ROMAN[s[i + 1]!]! : 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

type Marker = { roman: string; num: number; addresseeRaw: string; start: number; contentStart: number };
type Letter = { collection: "personal" | "trajan"; num: number; informant: string; text: string };

function cleanBody(raw: string): string {
  return raw
    .replace(/\[\s*\d+\s*\]/g, "")
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0)
    .join("\n\n");
}

/** "To SEPTITTUS" -> "Septitius" (title case; drop the leading "To"). */
function parseInformant(addresseeRaw: string, collection: "personal" | "trajan"): string {
  let s = addresseeRaw.trim();
  if (collection === "trajan") return /TRAJAN TO PLINY/i.test(s) ? "Pliny" : "Trajan";
  s = s.replace(/^To\s+/i, "").replace(/^THE EMPEROR\s+/i, "");
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Pure parse (no I/O — unit-tested). Gutenberg plain text → the two letter collections. */
export function parsePliny(fullText: string): Letter[] {
  const text = fullText.replace(/\r\n/g, "\n");
  const startM = /\*\*\* START OF/.exec(text);
  const endM = /\*\*\* END OF/.exec(text);
  const region = text.slice(startM ? startM.index : 0, endM ? endM.index : undefined);

  const re = /^([IVXLC]+) -- (.+?)\s*$/gm;
  const marks: Marker[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(region)) !== null) {
    marks.push({
      roman: m[1]!,
      num: romanToInt(m[1]!),
      addresseeRaw: m[2]!.replace(/\[\d+\]\s*$/, ""),
      start: m.index,
      contentStart: re.lastIndex,
    });
  }

  // A real body entry has substantial text before the next marker; a TOC
  // line does not. Keep only the "real" ones.
  const real = marks.filter((mk, i) => {
    const nextStart = marks[i + 1]?.start ?? region.length;
    return nextStart - mk.contentStart >= MIN_BODY_CHARS;
  });

  // The numbering restarts at I for the Trajan correspondence — that reset
  // marks the collection boundary (same technique as the Meditations parser).
  const out: Letter[] = [];
  let collection: "personal" | "trajan" = "personal";
  let prev = 0;
  for (let i = 0; i < real.length; i++) {
    const mk = real[i]!;
    if (mk.num === 1 && prev > 1) collection = "trajan";
    prev = mk.num;
    const nextStart = real[i + 1]?.start ?? region.length;
    const body = cleanBody(region.slice(mk.contentStart, nextStart));
    if (!body) continue;
    out.push({ collection, num: mk.num, informant: parseInformant(mk.addresseeRaw, collection), text: body });
  }
  return out;
}

function toStory(l: Letter): Story {
  const ref = l.collection === "trajan" ? `Plin. Ep. Traj. ${l.num}` : `Plin. Ep. ${l.num}`;
  const title =
    l.collection === "trajan"
      ? `Pliny–Trajan Correspondence ${l.num} (${l.informant === "Pliny" ? "Trajan to Pliny" : "Pliny to Trajan"})`
      : `Pliny, Letters ${l.num} (to ${l.informant})`;
  return {
    id: `${SOURCE}__${slugify(`${l.collection}-${l.num}`)}`,
    source: SOURCE,
    source_url: PAGE_URL,
    title,
    author: AUTHOR,
    is_reference: false,
    informant: l.informant,
    category: "letter",
    cicero_ref: ref,
    page_range: null,
    english_text: l.text,
    footnotes: null,
    latin_text: null,
    translator: TRANSLATOR,
    edition: EDITION,
    mantis_cycle: false,
    canonical_story_group: null,
  };
}

/** Scraper entrypoint registered in ../index.ts as `pliny-letters`. */
export async function scrapePliny(): Promise<Story[]> {
  const raw = await fetchCached(URL);
  const letters = parsePliny(raw);
  const personal = letters.filter((l) => l.collection === "personal").length;
  const trajan = letters.filter((l) => l.collection === "trajan").length;
  console.log(`  Pliny, Letters: ${personal} personal + ${trajan} Trajan-correspondence (English-only)`);
  return letters.map(toStory);
}

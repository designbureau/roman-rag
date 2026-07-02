/**
 * Augustus — Res Gestae Divi Augusti ("The Deeds of the Divine Augustus").
 *
 * Augustus's first-person account of his own reign, inscribed on bronze pillars
 * before his mausoleum (the surviving copy is the Monumentum Ancyranum). Unlike
 * the Meditations, the original is LATIN, so this is genuine parallel text using
 * the existing latin_text / english_text columns — chapter-aligned (the 35-chapter
 * division is canonical and universal, so alignment is a clean integer join).
 *
 *   Latin:   The Latin Library (public domain), chapters marked "[ N ]".
 *   English: Thomas Bushnell, "The Deeds of the Divine Augustus" (1998), via
 *            Wikisource, sections marked "===N===". Bushnell's translation is
 *            copyright but explicitly licensed for free distribution/excerpting
 *            provided the notice is retained — recorded in `edition` below.
 *
 * Units: a preface ("RG pr."), 35 numbered chapters ("RG N"), and a 4-part
 * appendix ("RG App. N"). The Latin appendix restarts its numbering at 1, which
 * is how we detect the boundary.
 */
import type { Story } from "@roman/shared";
import { slugify } from "@roman/shared";

import { fetchCached } from "../cache.js";

const SOURCE = "res-gestae";
const AUTHOR = "Augustus";
const TRANSLATOR = "Thomas Bushnell";
const EDITION =
  "Latin: The Latin Library (public domain). English: Thomas Bushnell, The Deeds of the Divine Augustus (1998), via Wikisource — © Thomas Bushnell, freely distributable with notice retained.";
const LATIN_URL = "https://www.thelatinlibrary.com/resgestae.html";
const ENGLISH_URL = "https://en.wikisource.org/w/index.php?title=The_Deeds_of_the_Divine_Augustus&action=raw";
const PAGE_URL = "https://en.wikisource.org/wiki/The_Deeds_of_the_Divine_Augustus";

const APPENDIX_ROMAN = ["i", "ii", "iii", "iv"];
const NL = String.fromCharCode(0); // paragraph-break sentinel

function stripTags(htmlStr: string): string {
  let s = htmlStr.replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(+d));
  return s;
}

/** Strip MediaWiki markup down to reading prose, joining soft-wrapped lines. */
function cleanWiki(s: string): string {
  let out = s.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<ref[^>]*\/>/gi, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  for (let i = 0; i < 4; i++) out = out.replace(/\{\{[^{}]*\}\}/g, ""); // nested templates
  out = out.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "");
  out = out.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2"); // [[a|b]]→b, [[a]]→a
  out = out.replace(/'{2,}/g, ""); // bold/italic
  out = out.replace(/^=+\s*(.*?)\s*=+$/gm, "$1"); // stray headers
  // Blank lines mark paragraph breaks; single newlines are soft wraps.
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*\n+/g, NL) // paragraph break → sentinel
    .replace(/\n/g, " ") // soft wrap → space
    .split(NL)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

type Unit = { key: string; ref: string; title: string; latin: string; english: string };

/** Latin: preface + main chapters (1..35) + appendix (restart 1..4). */
export function parseLatin(rawHtml: string): { preface: string; main: Map<number, string>; appendix: Map<number, string> } {
  let text = stripTags(rawHtml).replace(/\s+/g, " ").trim();
  // Cut the Latin Library footer nav if present.
  const foot = text.search(/The Latin Library|The Classics Page/i);
  if (foot > 0) text = text.slice(0, foot);

  const re = /\[\s*(\d+)\s*\]/g;
  const marks: { num: number; start: number; contentStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) marks.push({ num: +m[1]!, start: m.index, contentStart: re.lastIndex });

  const preface = marks.length ? text.slice(0, marks[0]!.start).trim() : text.trim();
  const main = new Map<number, string>();
  const appendix = new Map<number, string>();
  let mode: "main" | "appendix" = "main";
  let prev = 0;
  for (let i = 0; i < marks.length; i++) {
    const { num, contentStart } = marks[i]!;
    const content = text.slice(contentStart, marks[i + 1]?.start ?? text.length).trim();
    if (mode === "main" && num <= prev) mode = "appendix"; // numbering reset → appendix
    (mode === "main" ? main : appendix).set(num, content);
    prev = num;
  }
  return { preface, main, appendix };
}

/** English (Bushnell wikitext): preface + ===N=== chapters + ===i..iv=== appendix. */
export function parseEnglish(rawWiki: string): { preface: string; main: Map<number, string>; appendix: Map<string, string> } {
  const re = /^===\s*(\w+)\s*===\s*$/gm;
  const marks: { key: string; start: number; contentStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawWiki)) !== null) marks.push({ key: m[1]!, start: m.index, contentStart: re.lastIndex });

  // Preface: from the end of the header/TOC block to the first ===section===.
  let prefRaw = marks.length ? rawWiki.slice(0, marks[0]!.start) : rawWiki;
  const toc = prefRaw.lastIndexOf("__NOTOC__");
  if (toc >= 0) prefRaw = prefRaw.slice(toc + "__NOTOC__".length);
  const preface = cleanWiki(prefRaw);

  const main = new Map<number, string>();
  const appendix = new Map<string, string>();
  for (let i = 0; i < marks.length; i++) {
    const { key, contentStart } = marks[i]!;
    const content = cleanWiki(rawWiki.slice(contentStart, marks[i + 1]?.start ?? rawWiki.length));
    if (/^\d+$/.test(key)) main.set(+key, content);
    else appendix.set(key.toLowerCase(), content);
  }
  return { preface, main, appendix };
}

/** Pure build (no I/O — unit-tested). Aligns the two sides by chapter. */
export function buildUnits(rawLatin: string, rawEnglish: string): Unit[] {
  const lat = parseLatin(rawLatin);
  const eng = parseEnglish(rawEnglish);
  const units: Unit[] = [];

  if (lat.preface || eng.preface) {
    units.push({ key: "pr", ref: "RG pr.", title: "Res Gestae (preface)", latin: lat.preface, english: eng.preface });
  }
  const maxCh = Math.max(...lat.main.keys(), ...eng.main.keys(), 0);
  for (let n = 1; n <= maxCh; n++) {
    const latin = lat.main.get(n) ?? "";
    const english = eng.main.get(n) ?? "";
    if (!latin && !english) continue;
    units.push({ key: `${n}`, ref: `RG ${n}`, title: `Res Gestae ${n}`, latin, english });
  }
  // Appendix: Latin 1..4 ↔ English i..iv, joined by position.
  for (let i = 0; i < APPENDIX_ROMAN.length; i++) {
    const latin = lat.appendix.get(i + 1) ?? "";
    const english = eng.appendix.get(APPENDIX_ROMAN[i]!) ?? "";
    if (!latin && !english) continue;
    units.push({
      key: `app-${i + 1}`,
      ref: `RG App. ${i + 1}`,
      title: `Res Gestae, Appendix ${i + 1}`,
      latin,
      english,
    });
  }
  return units;
}

function toStory(u: Unit): Story {
  return {
    id: `${SOURCE}__${slugify(u.key)}`,
    source: SOURCE,
    source_url: PAGE_URL,
    title: u.title,
    author: AUTHOR,
    is_reference: false,
    informant: null,
    category: "inscription",
    cicero_ref: u.ref,
    page_range: null,
    english_text: u.english,
    footnotes: null,
    latin_text: u.latin || null,
    translator: u.english ? TRANSLATOR : null,
    edition: EDITION,
    mantis_cycle: false,
    canonical_story_group: null,
  };
}

/** Scraper entrypoint registered in ../index.ts as `res-gestae`. */
export async function scrapeResGestae(): Promise<Story[]> {
  const [rawLatin, rawEnglish] = await Promise.all([fetchCached(LATIN_URL), fetchCached(ENGLISH_URL)]);
  const units = buildUnits(rawLatin, rawEnglish);
  const parallel = units.filter((u) => u.latin && u.english).length;
  console.log(`  Res Gestae: ${units.length} units, ${parallel} with both Latin + English (Augustus, parallel)`);
  return units.map(toStory);
}

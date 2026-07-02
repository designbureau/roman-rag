/**
 * Seneca the Younger — Epistulae Morales ad Lucilium (Moral Letters to
 * Lucilius). 124 letters, Stoic in substance like Marcus Aurelius but earlier,
 * sharper, and far more worldly — a deliberate contrast voice.
 *
 * Latin: Perseus `canonical-latinLit` phi1017.phi015 (no English translation
 * on Perseus). The letters are traditionally cited by a single running number
 * (1–124), NOT by (book, letter-within-book) — the "books" are just how the
 * ancient collection was bundled. Perseus's `letter` divs restart numbering
 * per book, so we assign the epistle number by DOCUMENT ORDER (the edition
 * preserves the traditional sequence), which lines up with Wikisource's own
 * "Letter N" numbering used for the English side.
 *
 * English: Richard M. Gummere's 1917–1925 Loeb translation, via Wikisource
 * ("Moral letters to Lucilius/Letter N", one page per letter, transcluded
 * from a proofread scan — the rendered HTML carries the letter text, unlike
 * the raw wikitext which only has a `<pages>` transclusion tag).
 */
import type { Story } from "@roman/shared";
import { slugify } from "@roman/shared";

import { loadTEI, cleanText, scaifeUrl } from "./perseus-tei.js";
import { discoverEditions, perseusAuthorBase } from "./work-registry.js";
import { fetchCached } from "../cache.js";

const SENECA_BASE = perseusAuthorBase("phi1017");
const WORK_DIR = "phi015";
const LETTER_COUNT = 124;
const TRANSLATOR = "Richard M. Gummere";

/** Latin: every letter div, in document order, numbered 1..N (see module doc). */
async function parseLatin(latUrl: string): Promise<Map<number, string>> {
  const $ = await loadTEI(latUrl);
  const out = new Map<number, string>();
  let i = 0;
  $('div[subtype="letter"]').each((_j, el) => {
    i += 1;
    const text = cleanText($(el));
    if (text) out.set(i, text);
  });
  return out;
}

function stripHtml(html: string): string {
  let s = html.replace(/<(script|style|table)\b[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<\/(p|div|li)>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(+d));
  return s;
}

/** Pure extraction (unit-tested): rendered Wikisource HTML → clean letter body. */
export function extractLetterBody(renderedHtml: string): string {
  let text = stripHtml(renderedHtml);
  // The real body starts after the wst-header info-box, which reliably ends
  // "<translator> <author>" ("Richard Mott Gummere Seneca"). The running page
  // caption "THE EPISTLES OF SENECA" is NOT a reliable anchor — it's a printed
  // page header that only appears on some transcluded scan pages, not every
  // letter (e.g. it is absent for Letter 47), which silently produced an
  // empty body before this fix.
  // Whitespace-tolerant: inline element boundaries between "Gummere" and
  // "Seneca" sometimes collapse to two spaces rather than one, which broke a
  // literal-string anchor match here (and silently produced an empty body —
  // e.g. for Letter 47 — since indexOf then returned -1).
  const anchorMatch = /Richard Mott Gummere\s+Seneca/.exec(text);
  if (anchorMatch) text = text.slice(anchorMatch.index + anchorMatch[0].length);
  // Zero-width spaces show up in the scanned-page transclusion; \s doesn't
  // match them, so strip explicitly before the heading regexes below.
  text = text.replace(/\u200B/g, "");
  // Some (not all) transcluded pages carry the printed running header
  // "THE EPISTLES OF SENECA" right before the letter's own heading — drop it
  // if present, then drop the roman-numeral + ALL-CAPS subtitle line itself
  // ("I. ON SAVING TIME") — the citation ref carries this instead.
  text = text.replace(/^\s*(?:THE EPISTLES OF SENECA\s*)?/, "");
  text = text.replace(/^\s*[IVXLCDM]+\.\s*[A-Z][A-Z ,'\-]*\n/, "");
  // End at the last "Farewell." (the standard Roman letter close); footnote
  // reference lists follow and must not leak into the body.
  const lastFarewell = text.lastIndexOf("Farewell.");
  if (lastFarewell >= 0) text = text.slice(0, lastFarewell + "Farewell.".length);
  // Safety net for the rare letter where "Farewell." isn't the true end (e.g.
  // Letter 87): Wikisource's footnote back-references always open with "↑",
  // which never appears in the prose itself — cut there too, so a
  // translator's editorial note can never be mistaken for Seneca's own words.
  const arrowIdx = text.indexOf("↑");
  if (arrowIdx >= 0) text = text.slice(0, arrowIdx);
  // Strip inline footnote markers like "[ 1 ]".
  text = text.replace(/\[\s*\d+\s*\]/g, "");
  return text
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0)
    .join("\n\n");
}

async function fetchLetterHtml(n: number): Promise<string> {
  const page = encodeURIComponent(`Moral letters to Lucilius/Letter ${n}`);
  const url = `https://en.wikisource.org/w/api.php?action=parse&page=${page}&format=json&prop=text`;
  const raw = await fetchCached(url);
  try {
    const json = JSON.parse(raw) as { parse?: { text?: { "*"?: string } }; error?: unknown };
    if (json.error || !json.parse?.text?.["*"]) return "";
    return json.parse.text["*"];
  } catch {
    return "";
  }
}

/** Scraper entrypoint registered in ../index.ts as `seneca-epistulae`. */
export async function scrapeSenecaEpistulae(): Promise<Story[]> {
  const ed = await discoverEditions(WORK_DIR, SENECA_BASE);
  const lat = await parseLatin(ed.latUrl);

  const stories: Story[] = [];
  let aligned = 0;
  for (let n = 1; n <= LETTER_COUNT; n++) {
    const latText = lat.get(n) ?? null;
    let engText = "";
    try {
      const html = await fetchLetterHtml(n);
      if (html) engText = extractLetterBody(html);
    } catch (err) {
      console.error(`  seneca letter ${n}: english fetch failed: ${(err as Error).message}`);
    }
    if (latText && engText) aligned += 1;

    stories.push({
      id: `seneca-epistulae__${slugify(`ep-${n}`)}`,
      source: "seneca-epistulae",
      source_url: latText ? scaifeUrl(ed.latUrn, `${n}`) : `https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_${n}`,
      title: `Moral Letters ${n}`,
      author: "Seneca",
      is_reference: false,
      informant: "Lucilius",
      category: "letter",
      cicero_ref: `Ep. ${n}`,
      page_range: null,
      english_text: engText,
      footnotes: null,
      latin_text: latText,
      translator: engText ? TRANSLATOR : null,
      edition: ed.latEdition,
      mantis_cycle: false,
      canonical_story_group: null,
    });
  }
  console.log(`  Seneca, Moral Letters: ${LETTER_COUNT} letters, ${aligned} with both Latin + English`);
  return stories;
}

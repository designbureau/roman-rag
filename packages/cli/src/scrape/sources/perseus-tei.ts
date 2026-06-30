/**
 * Shared Perseus TEI helpers.
 *
 * The Cicero corpus lives in the Perseus `canonical-latinLit` repo under author
 * `phi0474`. Each work has paired editions — a Latin `<edition>` and (usually)
 * an English `<translation>` — as TEI-P5 XML. The body is a tree of
 * `<div type="textpart">` keyed by canonical citation (book → letter → section
 * for the letters; book → section for treatises/orations).
 *
 * These helpers load a TEI file (via the on-disk fetch cache) and extract clean
 * reading text from any element, dropping the editorial apparatus that must
 * never leak into the corpus:
 *   - `<note>`      editorial footnotes
 *   - `<head>`      div headings / letter numbering ("I (A I, 5)")
 *   - `<epigraph>` / `<argument>`  Shuckburgh's per-letter historical headnote
 *   - `<pb>`        page-break markers (can fall mid-sentence)
 * and converting `<milestone unit="para"/>` into paragraph breaks so the
 * downstream paragraph chunker has something to split on.
 *
 * See docs/cicero-archive-plan.md §4 for the validated alignment approach.
 */
import * as cheerio from "cheerio";

import { fetchCached } from "../cache.js";

export type TEI = cheerio.CheerioAPI;

/** Load and parse a TEI XML file in XML mode (namespace-preserving). */
export async function loadTEI(url: string): Promise<TEI> {
  const xml = await fetchCached(url);
  return cheerio.load(xml, { xml: true });
}

// Sentinel marking a paragraph boundary while we flatten an element to text.
// A control char that cannot occur in the source survives `.text()` intact.
const PARA = "";

// Elements whose text content is editorial apparatus, never the work itself.
const DROP_SELECTORS = ["note", "head", "epigraph", "argument", "pb"];

/**
 * Flatten a TEI element to clean reading text.
 *
 * Paragraph milestones become blank-line separators; editorial elements are
 * removed; runs of whitespace are collapsed. Returns paragraphs joined by
 * `\n\n`, which is exactly what {@link buildParagraphChunks} splits on.
 */
export function cleanText($el: cheerio.Cheerio<any>): string {
  if ($el.length === 0) return "";
  const $clone = $el.clone();
  $clone.find('milestone[unit="para"]').replaceWith(PARA);
  for (const sel of DROP_SELECTORS) $clone.find(sel).remove();
  return $clone
    .text()
    .split(PARA)
    .map((seg) => seg.replace(/\s+/g, " ").trim())
    .filter((seg) => seg.length > 0)
    .join("\n\n");
}

/**
 * Build the canonical Scaife reader URL for a passage, e.g.
 * `…:phi0474.phi057.perseus-lat1:1.5/`.
 */
export function scaifeUrl(editionUrn: string, passage: string): string {
  return `https://scaife.perseus.org/reader/${editionUrn}:${passage}/`;
}

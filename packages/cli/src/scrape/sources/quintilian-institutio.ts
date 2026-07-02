/**
 * Quintilian — Institutio Oratoria (the Education of an Orator). Twelve books
 * on rhetoric, argument, and the formation of a public speaker — the treatise
 * Cicero's own rhetorical works are in conversation with a generation later,
 * and (per Pliny's letters) Pliny the Younger's own teacher.
 *
 * Parallel Latin + English from Perseus `canonical-latinLit` (phi1002.phi001):
 * Butler's 1920s Loeb translation. Structure is book > chapter > section on
 * both sides, but the two editions don't always divide chapters identically
 * (a book's front matter may sit directly under "pr" rather than a numbered
 * chapter) — so we align at (book, chapter), collapsing each chapter's
 * sections into one passage, and follow the "never drop a side" rule for
 * chapters present on only one side.
 */
import type { Story } from "@roman/shared";
import { slugify } from "@roman/shared";

import { loadTEI, cleanText, scaifeUrl, type TEI } from "./perseus-tei.js";
import { discoverEditions, perseusAuthorBase } from "./work-registry.js";

const QUINTILIAN_BASE = perseusAuthorBase("phi1002");
const WORK_DIR = "phi001";
const ABBREV = "Inst.";

/** Walk book > chapter, collapsing each chapter's section children (or its own text) into one passage. */
function parseBookChapter($: TEI): Map<string, string> {
  const out = new Map<string, string>();
  $('div[subtype="book"]').each((_i, bookEl) => {
    const $book = $(bookEl);
    const book = ($book.attr("n") ?? "").trim();
    if (!book) return;
    $book.children('div[subtype="chapter"]').each((_j, chEl) => {
      const $ch = $(chEl);
      const ch = ($ch.attr("n") ?? "").trim();
      if (!ch) return;
      const $sections = $ch.children('div[subtype="section"]');
      let text: string;
      if ($sections.length > 0) {
        const parts: string[] = [];
        $sections.each((_k, sec) => {
          const t = cleanText($(sec));
          if (t) parts.push(t);
        });
        text = parts.join("\n\n");
      } else {
        text = cleanText($ch);
      }
      if (text) out.set(`${book}.${ch}`, text);
    });
  });
  return out;
}

/** Scraper entrypoint registered in ../index.ts as `quintilian-institutio`. */
export async function scrapeQuintilian(): Promise<Story[]> {
  const ed = await discoverEditions(WORK_DIR, QUINTILIAN_BASE);
  const lat = parseBookChapter(await loadTEI(ed.latUrl));
  const eng = ed.engUrl ? parseBookChapter(await loadTEI(ed.engUrl)) : new Map<string, string>();

  const keys = new Set<string>([...lat.keys(), ...eng.keys()]);
  const stories: Story[] = [];
  let aligned = 0;
  for (const key of keys) {
    const latText = lat.get(key) ?? null;
    const engText = eng.get(key) ?? "";
    if (latText && engText) aligned += 1;
    const urn = latText ? ed.latUrn : ed.engUrn ?? ed.latUrn;

    stories.push({
      id: `quintilian-institutio__${slugify(key)}`,
      source: "quintilian-institutio",
      source_url: scaifeUrl(urn, key),
      title: `Institutio Oratoria ${key}`,
      author: "Quintilian",
      is_reference: false,
      informant: null,
      category: "rhetorica",
      cicero_ref: `${ABBREV} ${key}`,
      page_range: null,
      english_text: engText,
      footnotes: null,
      latin_text: latText,
      translator: engText ? ed.translator : null,
      edition: ed.latEdition,
      mantis_cycle: false,
      canonical_story_group: null,
    });
  }
  const cov = lat.size > 0 ? ((100 * aligned) / lat.size).toFixed(1) : "0.0";
  console.log(`  Institutio Oratoria: Latin ${lat.size}  English ${eng.size}  aligned ${aligned} (${cov}% of Latin)`);
  return stories;
}

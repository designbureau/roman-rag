/**
 * Julius Caesar — Commentarii: De Bello Gallico (the Gallic War) and De Bello
 * Civili (the Civil War). Genuine first-person military memoir, parallel
 * Latin + English, from Perseus `canonical-latinLit` (author phi0448) — same
 * TEI walker as the Cicero letters, aligned at (book, chapter) instead of
 * (book, letter): both editions nest `div[subtype=book] > div[subtype=chapter]`
 * with matching numeric chapter numbers, so no suffix normalisation is needed.
 *
 * This replaces the earlier stopgap of having the Caesar persona borrow
 * Cicero's corpus for retrieval — Caesar now has his own author-scoped corpus.
 */
import type { Story } from "@roman/shared";
import { slugify } from "@roman/shared";

import { loadTEI, cleanText, scaifeUrl, type TEI } from "./perseus-tei.js";
import { discoverEditions, perseusAuthorBase, type Editions } from "./work-registry.js";

const CAESAR_BASE = perseusAuthorBase("phi0448");

type CaesarWork = {
  workDir: string;
  source: "caesar-gallic-war" | "caesar-civil-war";
  abbrev: string;
  title: string;
};

const GALLIC_WAR: CaesarWork = { workDir: "phi001", source: "caesar-gallic-war", abbrev: "B.G.", title: "De Bello Gallico" };
const CIVIL_WAR: CaesarWork = { workDir: "phi002", source: "caesar-civil-war", abbrev: "B.C.", title: "De Bello Civili" };

/** Walk book > chapter divs, collapsing each chapter's text into one passage. */
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
      const text = cleanText($ch);
      if (text) out.set(`${book}.${ch}`, text);
    });
  });
  return out;
}

/** Pure alignment + Story construction (unit-tested directly). */
export function buildStories(
  lat: Map<string, string>,
  eng: Map<string, string>,
  work: CaesarWork,
  ed: Editions,
): { stories: Story[]; aligned: number } {
  const keys = new Set<string>([...lat.keys(), ...eng.keys()]);
  const stories: Story[] = [];
  let aligned = 0;

  for (const key of keys) {
    const latText = lat.get(key) ?? null;
    const engText = eng.get(key) ?? "";
    if (latText && engText) aligned += 1;
    const urn = latText ? ed.latUrn : ed.engUrn ?? ed.latUrn;

    stories.push({
      id: `${work.source}__${slugify(key)}`,
      source: work.source,
      source_url: scaifeUrl(urn, key),
      title: `${work.title} ${key}`,
      author: "Julius Caesar",
      is_reference: false,
      informant: null,
      category: "commentary",
      cicero_ref: `${work.abbrev} ${key}`,
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
  return { stories, aligned };
}

async function scrapeWork(work: CaesarWork): Promise<Story[]> {
  const ed = await discoverEditions(work.workDir, CAESAR_BASE);
  const lat = parseBookChapter(await loadTEI(ed.latUrl));
  const eng = ed.engUrl ? parseBookChapter(await loadTEI(ed.engUrl)) : new Map<string, string>();
  const { stories, aligned } = buildStories(lat, eng, work, ed);
  const cov = lat.size > 0 ? ((100 * aligned) / lat.size).toFixed(1) : "0.0";
  console.log(`  ${work.title}: Latin ${lat.size}  English ${eng.size}  aligned ${aligned} (${cov}% of Latin)`);
  return stories;
}

/** Scraper entrypoint registered in ../index.ts as `caesar-gallic-war` + `caesar-civil-war`. */
export async function scrapeCaesarGallicWar(): Promise<Story[]> {
  return scrapeWork(GALLIC_WAR);
}
export async function scrapeCaesarCivilWar(): Promise<Story[]> {
  return scrapeWork(CIVIL_WAR);
}

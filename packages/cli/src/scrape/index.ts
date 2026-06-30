/**
 * Scrape entrypoint. Runs all configured sources or just one (--source=...).
 * Writes id-keyed data/stories.json. Idempotent.
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Source, Story } from "@roman/shared";

// Cicero source modules are added here as they are implemented. The Perseus
// `canonical-latinLit` (phi0474) corpus is the primary source; each module
// parses paired Latin/English TEI editions and aligns them by canonical
// citation ref (see docs/cicero-archive-plan.md, §4). Expected modules:
//   ./sources/cicero-letters-att.js  → "letters-att"
//   ./sources/cicero-letters-fam.js  → "letters-fam"
//   ./sources/cicero-orations.js     → "orations"
//   ./sources/cicero-philosophica.js → per-work treatise sources
//   ./sources/cicero-rhetorica.js    → "rhetorica"

type Scraper = () => Promise<Story[]>;

const SCRAPERS: Record<string, Scraper> = {
  // populated as Cicero source modules land
};

const DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data",
);
const STORIES_FILE = path.join(DATA_DIR, "stories.json");

function parseArgs(argv: string[]): { source?: Source } {
  for (const a of argv) {
    if (a.startsWith("--source=")) return { source: a.slice("--source=".length) as Source };
  }
  return {};
}

async function loadExisting(): Promise<Map<string, Story>> {
  try {
    const raw = await readFile(STORIES_FILE, "utf8");
    const arr = JSON.parse(raw) as Story[];
    return new Map(arr.map((s) => [s.id, s]));
  } catch {
    return new Map();
  }
}

async function main() {
  const { source } = parseArgs(process.argv.slice(2));
  const targets = source
    ? source in SCRAPERS
      ? [source]
      : (() => {
          throw new Error(`Unknown source ${source}. Known: ${Object.keys(SCRAPERS).join(", ")}`);
        })()
    : Object.keys(SCRAPERS);

  await mkdir(DATA_DIR, { recursive: true });
  const stories = await loadExisting();

  for (const key of targets) {
    const fn = SCRAPERS[key];
    if (!fn) continue;
    console.log(`▶ scrape ${key}`);
    const found = await fn();
    console.log(`  ${found.length} stories`);
    // When we re-scrape a source, drop existing stories from that source
    // before inserting new ones (idempotent overwrite).
    for (const [id, s] of stories) if (s.source === key) stories.delete(id);
    for (const s of found) stories.set(s.id, s);
  }

  // Cross-source dedup pass: stories that retell the same narrative
  // across multiple sources (e.g. ǁkabbo's railway journey in Specimens
  // 1911 + Second Report 1875, or "The Mantis and the Cat" in DBLC + the
  // 1924 Mantis volume) get the same `canonical_story_group` token so
  // retrieval can surface them together as variants. v1 keys on a
  // normalised title — coarse but cheap and high-precision; sense-level
  // overlap that doesn't share a title is left to roadmap.
  assignCanonicalStoryGroups(stories);

  const arr = [...stories.values()].sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(STORIES_FILE, JSON.stringify(arr, null, 2), "utf8");
  console.log(`Wrote ${arr.length} stories → ${STORIES_FILE}`);
}

function normaliseTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[ǀǁǃǂ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(?:a|an|the|and|of|in|on|at|to|by)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mutates the stories map in place. Groups by normalised title; any group
 * spanning ≥ 2 distinct sources gets `canonical_story_group = <key>`.
 * Same-source duplicates are ignored (they're a different problem — the
 * scrapers should already de-dup intra-source).
 */
function assignCanonicalStoryGroups(stories: Map<string, Story>): void {
  const byKey = new Map<string, Story[]>();
  for (const s of stories.values()) {
    const k = normaliseTitle(s.title);
    if (k.length < 4) continue;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(s);
  }
  let groups = 0;
  let assigned = 0;
  for (const [key, group] of byKey) {
    const sources = new Set(group.map((s) => s.source));
    if (sources.size < 2) continue;
    for (const s of group) s.canonical_story_group = key;
    groups += 1;
    assigned += group.length;
  }
  console.log(`Cross-source canonical groups: ${groups} (${assigned} stories)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

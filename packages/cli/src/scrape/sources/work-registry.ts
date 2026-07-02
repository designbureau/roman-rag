/**
 * Cicero work registry + Perseus edition discovery.
 *
 * Each Cicero work is a folder `phiNNN` under
 * `canonical-latinLit/data/phi0474/`. Edition file naming is NOT uniform — do
 * not hardcode `perseus-lat2`/`perseus-eng1`. Instead, read each work's
 * `__cts__.xml` and discover the actual `<ti:edition>` (Latin) and
 * `<ti:translation>` (English) URNs, then derive the TEI filenames from them.
 * See docs/cicero-archive-plan.md §4, refinement (1).
 *
 * For the ad Atticum vertical slice only `phi057` is wired up; the registry is
 * structured so the remaining works slot in beside it.
 */
import type { Source } from "@roman/shared";

import { fetchCached } from "../cache.js";

const RAW_BASE =
  "https://raw.githubusercontent.com/PerseusDL/canonical-latinLit/master/data/phi0474";

/** Perseus `canonical-latinLit` base for a given author code, e.g. "phi0448" (Caesar). */
export function perseusAuthorBase(authorCode: string): string {
  return `https://raw.githubusercontent.com/PerseusDL/canonical-latinLit/master/data/${authorCode}`;
}

/** A Cicero work: its Perseus folder plus the domain metadata we stamp on every Story. */
export type Work = {
  /** Perseus folder under phi0474, e.g. "phi057". */
  workDir: string;
  /** `Story.source` bucket. */
  source: Source;
  /** `Story.category` (genre). */
  genre: "oration" | "letter" | "dialogue" | "treatise" | "rhetorica";
  /** Citation abbreviation, e.g. "Att." */
  abbrev: string;
  /** Default addressee for letter works (→ `Story.informant`); null otherwise. */
  addressee: string | null;
};

/** Letters to Atticus — the vertical-slice work (validated alignment, §4). */
export const ATTICUS: Work = {
  workDir: "phi057",
  source: "letters-att",
  genre: "letter",
  abbrev: "Att.",
  addressee: "Atticus",
};

/** Editions discovered from a work's `__cts__.xml`. */
export type Editions = {
  title: string;
  latUrn: string;
  latUrl: string;
  latEdition: string | null;
  engUrn: string | null;
  engUrl: string | null;
  translator: string | null;
};

/** `urn:cts:latinLit:phi0474.phi057.perseus-lat1` → `phi0474.phi057.perseus-lat1.xml`. */
function urnToFile(urn: string): string {
  return `${urn.replace(/^urn:cts:latinLit:/, "")}.xml`;
}

function firstMatch(re: RegExp, s: string): string | null {
  const m = re.exec(s);
  return m && m[1] ? m[1].replace(/\s+/g, " ").trim() : null;
}

/**
 * Read a work's `__cts__.xml` and return the Latin edition + English
 * translation URNs and their derived raw-file URLs. Throws if no Latin edition
 * is present; a missing English translation is allowed (engUrl/engUrn null) so
 * callers can fall back to another source.
 */
export async function discoverEditions(workDir: string, rawBase: string = RAW_BASE): Promise<Editions> {
  const cts = await fetchCached(`${rawBase}/${workDir}/__cts__.xml`);

  const title = firstMatch(/<ti:title[^>]*>([^<]+)<\/ti:title>/, cts) ?? workDir;

  const edBlock = /<ti:edition\b[^>]*\burn="([^"]+)"[^>]*>([\s\S]*?)<\/ti:edition>/.exec(cts);
  if (!edBlock || !edBlock[1]) {
    throw new Error(`work-registry: no <ti:edition> in ${workDir}/__cts__.xml`);
  }
  const latUrn = edBlock[1];
  const latEdition = firstMatch(/<ti:description[^>]*>([\s\S]*?)<\/ti:description>/, edBlock[2] ?? "");

  const trBlock = /<ti:translation\b[^>]*\burn="([^"]+)"[^>]*>([\s\S]*?)<\/ti:translation>/.exec(cts);
  let engUrn: string | null = null;
  let engUrl: string | null = null;
  let translator: string | null = null;
  if (trBlock && trBlock[1]) {
    engUrn = trBlock[1];
    engUrl = `${rawBase}/${workDir}/${urnToFile(engUrn)}`;
    translator = firstMatch(/<ti:description[^>]*>([\s\S]*?)<\/ti:description>/, trBlock[2] ?? "");
  }

  return {
    title,
    latUrn,
    latUrl: `${rawBase}/${workDir}/${urnToFile(latUrn)}`,
    latEdition,
    engUrn,
    engUrl,
    translator,
  };
}

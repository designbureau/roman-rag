// Core domain types, shared between CLI scrapers, embed pipeline, Edge Functions, and frontend.
//
// This is the Cicero ("roman-rag") adaptation of the Bleek-Lloyd archive model.
// The corpus is Cicero's own works as a Latin + English parallel text. See
// docs/cicero-archive-plan.md for the full plan.

// A `source` is a collection or standalone work. The homogeneous masses
// (orations, each letter-corpus) are collection-level; the major treatises are
// per-work so the reader can scope a search to a single book.
export const SOURCES = [
  "orations",
  "letters-att",
  "letters-fam",
  "letters-qfr",
  "letters-brut",
  "de-officiis",
  "de-natura-deorum",
  "de-divinatione",
  "de-finibus",
  "de-senectute",
  "de-amicitia",
  "de-legibus",
  "de-re-publica",
  "tusculanae",
  "academica",
  "paradoxa-stoicorum",
  "rhetorica",
  // Beyond Cicero — the archive is growing to a multi-author Roman corpus.
  "meditations", // Marcus Aurelius, Meditations (English-only; see marcus-meditations.ts)
  "res-gestae",  // Augustus, Res Gestae Divi Augusti (parallel Latin + English)
  "caesar-gallic-war",   // Julius Caesar, De Bello Gallico (parallel Latin + English)
  "caesar-civil-war",    // Julius Caesar, De Bello Civili (parallel Latin + English)
  "seneca-epistulae",    // Seneca the Younger, Epistulae Morales ad Lucilium (parallel Latin + English)
  "pliny-letters",       // Pliny the Younger, Letters (English-only; see pliny-letters.ts)
  "quintilian-institutio", // Quintilian, Institutio Oratoria (parallel Latin + English)
  // Reference / background corpus — not a figure's own words. Retrieved only
  // when the reader toggles "Roman context" on (marked is_reference below).
  "smith-antiquities",  // Smith's, A Smaller Dictionary of Greek & Roman Antiquities (1871)
  "fowler-social-life", // W. Warde Fowler, Social Life at Rome in the Age of Cicero (1908)
] as const;
export type Source = (typeof SOURCES)[number];

// Personas are data-driven: they are authored in the admin and stored in
// the `persona_config` table, so the runtime identifier is an open string.
// The fixed set the code ships built-in prompts and voices for is
// `BuiltinPersona` — the Roman ensemble (Phase 1). Phase-2 voices
// (sallust, livy, biographer) are authored via /admin once context texts are
// ingested.
export type Persona = string;

export type BuiltinPersona =
  | "classicist"
  | "cicero"
  | "tiro"
  | "atticus"
  | "caesar"
  | "marcus-aurelius"
  | "augustus"
  | "seneca"
  | "pliny-younger"
  | "quintilian";

export const BUILTIN_PERSONAS: ReadonlyArray<BuiltinPersona> = [
  "classicist",
  "cicero",
  "tiro",
  "atticus",
  "caesar",
  "marcus-aurelius",
  "augustus",
  "seneca",
  "pliny-younger",
  "quintilian",
] as const;

/**
 * Reserved `persona_config` key holding the editable global SHARED_RULES
 * block. It is not a persona: filter it out of every persona list (the
 * toggle, the chat resolver) and never expose it in the chat UI.
 */
export const SHARED_RULES_KEY = "__shared__";

/**
 * Fallback display titles for the built-ins, used only when the database
 * persona list is empty or unreachable. The source of truth for titles is
 * `persona_config.title`.
 */
export const PERSONA_TITLES: Record<BuiltinPersona, string> = {
  classicist: "The Classicist",
  cicero: "Cicero",
  tiro: "Tiro",
  atticus: "Atticus",
  caesar: "Caesar",
  "marcus-aurelius": "Marcus Aurelius",
  augustus: "Augustus",
  seneca: "Seneca",
  "pliny-younger": "Pliny the Younger",
  quintilian: "Quintilian",
};

export type Story = {
  id: string;                    // ${source}__${slug}, e.g. "letters-att__1-5"
  source: Source;
  source_url: string;            // Scaife reader URL for the passage
  title: string;                 // e.g. "In Catilinam I", "Letters to Atticus 1.5"
  author: string;                // corpus author, e.g. "Cicero", "Marcus Aurelius" — scopes bounded-figure retrieval
  is_reference: boolean;         // true = background/reference material (Smith's, Fowler), retrieved only when the reader opts in
  // Repurposed from the Bleek-Lloyd model to minimise downstream churn:
  informant: string | null;     // ADDRESSEE for letters (e.g. "Atticus"); null otherwise
  category: string | null;      // GENRE: "oration" | "letter" | "dialogue" | "treatise" | "rhetorica"
  cicero_ref: string | null;    // canonical citation, e.g. "Att. 1.5", "Cat. 1.1", "N.D. 2.18"
  page_range: string | null;
  english_text: string;
  footnotes: Footnote[] | null;
  latin_text: string | null;    // the Latin original of the passage
  translator: string | null;    // e.g. "Evelyn Shuckburgh", "C. D. Yonge"
  edition: string | null;       // underlying public-domain print edition
  // Deprecated |xam vestige; always false here. To be removed once the
  // search_chunks RPC + frontend badge are cleaned up (see plan).
  mantis_cycle: boolean;
  canonical_story_group: string | null;
};

export type Footnote = {
  marker: string;                // "1", "*", "†"
  body: string;
  paragraph_index?: number;      // where in the body it appeared, if known
};

export type ChunkType = "story" | "paragraph";

export type Chunk = {
  story_id: string;
  chunk_type: ChunkType;
  content: string;
  paragraph_index: number | null;
};

export type SearchOptions = {
  matchCount?: number;
  informant?: string;            // addressee
  category?: string;             // genre
  source?: Source;
  mantisCycle?: boolean;         // deprecated vestige
};

export type SearchResult = {
  chunk_id: string;
  story_id: string;
  story_title: string;
  source: Source;
  informant: string | null;      // addressee
  category: string | null;       // genre
  mantis_cycle: boolean;         // deprecated vestige
  chunk_type: ChunkType;
  content: string;
  source_url: string;
  latin_text: string | null;
  similarity: number;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * A persona "tier" — an authorable variant selector shown as a toggle in
 * the chat UI (the Storyteller's age tiers are the canonical use). Stored
 * as an ordered array in `persona_config.age_tiers`. A blank `prompt`
 * tracks the code default for that `key`; an empty array means the
 * persona has no tier selector.
 */
export type AgeTier = {
  key: string;          // open slug, e.g. "young" | "standard" | "teen"
  label: string;        // toggle button label, e.g. "Young"
  hint: string;         // tooltip / sub-label, e.g. "≈ 9+ years"
  prompt: string;       // system-prompt addendum; "" tracks the code default
  is_default?: boolean; // the tier selected when none is specified
};

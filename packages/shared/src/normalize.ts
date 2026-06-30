/**
 * Click-character normalisation for the |xam corpus.
 *
 * Per the data brief (lines 142-143, 267): canonical click consonants are the
 * Unicode codepoints ǀ ǁ ǃ ǂ. Source texts use a mix of ASCII fallbacks; we
 * normalise to canonical form for `informant`, `title`, and unambiguous |xam
 * tokens. We do NOT blanket-apply this to `english_text` — original glyphs
 * stay intact for fidelity to the source.
 *
 * The mappings:
 *   |   → ǀ   (dental click)
 *   ||  → ǁ   (lateral click)
 *   !   → ǃ   (alveolar click)
 *   ≠ / =/= / # → ǂ   (palatal click)
 */

// Canonical Unicode codepoints
export const DENTAL = "ǀ";   // ǀ
export const LATERAL = "ǁ";  // ǁ
export const ALVEOLAR = "ǃ"; // ǃ
export const PALATAL = "ǂ";  // ǂ

const CLICK_CHARS = new Set([DENTAL, LATERAL, ALVEOLAR, PALATAL]);

/**
 * Apply click-character normalisation to a |xam-bearing token (informant
 * name, title, or short |xam term).
 *
 * Order matters: || → ǁ before single | → ǀ; =/= and ≠ before # before
 * any single-char heuristics.
 */
export function normaliseClicks(input: string): string {
  let s = input;

  // Lateral first (two pipes) — must come before single pipe
  s = s.replace(/\|\|/g, LATERAL);

  // Palatal: ≠ and =/= and standalone # used in some sources
  s = s.replace(/=\/=/g, PALATAL);
  s = s.replace(/≠/g, PALATAL); // ≠

  // Standalone # → ǂ only when adjacent to |xam-y context (uppercase letter
  // or another click). This is conservative; a leading # in markdown headers
  // should NOT be touched.
  s = s.replace(/(^|[^\w])#(?=[A-Za-zǀǁǃǂ])/g, (_m, lead) => `${lead}${PALATAL}`);

  // Dental and alveolar — ASCII fallbacks
  s = s.replace(/\|/g, DENTAL);

  // Alveolar: bare !. Conservative — only normalise when adjacent to a vowel
  // or an existing click, to avoid mangling English exclamations.
  s = s.replace(/!(?=[aeiouAEIOUǀǁǃǂ])/g, ALVEOLAR);
  s = s.replace(/(?<=[ǀǁǃǂA-Z])!/g, ALVEOLAR);

  return s;
}

/**
 * Looser variant for entire body paragraphs where |xam terms may be embedded
 * in English prose. Same rules but skips bare !/# in clearly-English
 * contexts. Use sparingly.
 */
export function normaliseClicksInProse(input: string): string {
  // For prose we only convert the unambiguous compound forms; single-char
  // ASCII fallbacks are too risky inside English text.
  let s = input;
  s = s.replace(/\|\|/g, LATERAL);
  s = s.replace(/=\/=/g, PALATAL);
  s = s.replace(/≠/g, PALATAL);
  return s;
}

export function containsClick(s: string): boolean {
  for (const ch of s) {
    if (CLICK_CHARS.has(ch)) return true;
  }
  return false;
}

/**
 * Slugify a string for use in a story id. Drops click characters because URL
 * slugs have to be ASCII — but the canonical title/informant fields keep the
 * Unicode form.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[ǀ-ǃ]/g, "")          // strip click chars
    .replace(/[̀-ͯ]/g, "")           // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

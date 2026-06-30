/**
 * Wrap a head term in a determiner if it reads more naturally with "the".
 * Used by the topic browse views to seed the chat input as a sentence.
 *
 * The heuristic skips "the" for:
 *   - |xam names (click consonants ǀ ǁ ǃ ǂ or their ASCII | / ! fallbacks)
 *   - Capitalised words (proper nouns rendered in title case)
 *   - Multi-word phrases ("personal history", "early race")
 *   - Plurals (terms ending in `s`)
 *   - Gerunds / -ing nouns (`hunting`, `healing`)
 *   - A small explicit set of mass / abstract / generic-singular nouns
 *     where "the X" overspecifies ("food", "death", "name").
 *
 * Otherwise it prepends "the" — concrete singular nouns ("the lion",
 * "the moon", "the eland", "the wind").
 */
const NO_ARTICLE = new Set([
  // mass / abstract nouns
  "food",
  "death",
  "respect",
  "illness",
  "vocabulary",
  "transformation",
  "education",
  "speech",
  "work",
  "poison",
  "healing",
  "genealogy",
  "music",
  "marriage",
  "history",
  "language",
  // generic singulars where "the X" implies a specific X
  "name",
  "thing",
  "place",
  "person",
]);

export function withArticle(term: string): string {
  const t = term.trim();
  const skip =
    /[ǀǁǃǂ|!]/.test(t) ||       // contains a click → |xam name
    /^[A-Z]/.test(t) ||           // capitalised → proper noun
    t.includes(" ") ||            // multi-word phrase
    t.endsWith("s") ||            // plural-likely
    t.endsWith("ing") ||          // gerund / mass noun
    NO_ARTICLE.has(t.toLowerCase());
  return skip ? t : `the ${t}`;
}

/** "tell me about the lion" / "tell me about hunting" */
export function askAboutTerm(term: string): string {
  return `tell me about ${withArticle(term)}`;
}

/** "tell me what ǁkabbo said about the lion" */
export function askInformantAboutTerm(informant: string, term: string): string {
  return `tell me what ${informant} said about ${withArticle(term)}`;
}

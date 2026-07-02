/**
 * Wrap a head term in a determiner if it reads more naturally with "the".
 * Used by the topic browse views to seed the chat input as a sentence.
 *
 * The heuristic skips "the" for:
 *   - Names / Latin proper nouns (also any stray click marks, harmlessly)
 *   - Capitalised words (proper nouns rendered in title case)
 *   - Multi-word phrases ("personal history", "civil war")
 *   - Plurals (terms ending in `s`)
 *   - Gerunds / -ing nouns ("banishment" aside, e.g. "campaigning")
 *   - A small explicit set of mass / abstract / generic-singular nouns
 *     where "the X" overspecifies ("exile", "death", "name").
 *
 * Otherwise it prepends "the" — concrete singular nouns ("the consul",
 * "the letter", "the province", "the triumph").
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
    /[ǀǁǃǂ|!]/.test(t) ||       // stray click/marker → treat as a name
    /^[A-Z]/.test(t) ||           // capitalised → proper noun
    t.includes(" ") ||            // multi-word phrase
    t.endsWith("s") ||            // plural-likely
    t.endsWith("ing") ||          // gerund / mass noun
    NO_ARTICLE.has(t.toLowerCase());
  return skip ? t : `the ${t}`;
}

/** "tell me about the consul" / "tell me about exile" */
export function askAboutTerm(term: string): string {
  return `tell me about ${withArticle(term)}`;
}

/** "tell me what the letters to Atticus say about the consulship" */
export function askInformantAboutTerm(informant: string, term: string): string {
  return `tell me what the letters to ${informant} say about ${withArticle(term)}`;
}

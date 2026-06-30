/**
 * Heuristic citation extraction. A retrieved chunk is "cited" if its story
 * title or informant name appears in the assistant's response text.
 *
 * For v1 we send the full retrieved set as data.retrievedChunks; the UI can
 * highlight which were named. This module is the after-the-fact extractor
 * for non-streaming surfaces (logs, /api/search-style consumers).
 */
import type { SearchResult } from "./retrieve.ts";

export type Citation = {
  story_id: string;
  story_title: string;
  source: string;
  informant: string | null;
  source_url: string;
};

export function extractCitations(
  responseText: string,
  retrieved: SearchResult[],
): Citation[] {
  const text = responseText.toLowerCase();
  const seen = new Set<string>();
  const out: Citation[] = [];

  for (const c of retrieved) {
    if (seen.has(c.story_id)) continue;
    const titleHit = c.story_title && text.includes(c.story_title.toLowerCase());
    const informantHit =
      c.informant && text.includes(c.informant.toLowerCase());
    if (titleHit || informantHit) {
      seen.add(c.story_id);
      out.push({
        story_id: c.story_id,
        story_title: c.story_title,
        source: c.source,
        informant: c.informant,
        source_url: c.source_url,
      });
    }
  }

  return out;
}

/**
 * Format retrieved chunks into the context block that gets injected into the
 * persona system prompt. Per personas brief lines 245-255.
 */
import type { SearchResult } from "./retrieve.ts";

export function formatContext(chunks: SearchResult[]): string {
  if (!chunks.length) {
    return "No passages were retrieved for this query. Speak in-character about the absence — do not fabricate archive content.";
  }

  const lines: string[] = [
    "The following passages were retrieved from the Bleek-Lloyd notebooks for this query. Use them to ground your response — but do NOT reference them by index or as 'passages'; weave the content into your voice. Do not reference passages that aren't relevant.",
    "",
  ];

  chunks.forEach((c) => {
    const meta = [
      `Story: "${c.story_title}"`,
      `Source: ${c.source}`,
      c.informant ? `Informant: ${c.informant}` : "",
      c.category ? `Category: ${c.category}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    lines.push(`--- ${meta}`);
    lines.push(c.content);
    lines.push(`(Source URL: ${c.source_url})`);
    lines.push("");
  });

  return lines.join("\n");
}

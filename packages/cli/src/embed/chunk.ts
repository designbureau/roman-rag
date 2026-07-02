/**
 * Chunking. Two chunk kinds per story:
 *
 *   - story:     full body, preceded by a provenance preface (data brief
 *                lines 183-188). Gives the model context to reason about
 *                source provenance even on a short retrieval window.
 *   - paragraph: each paragraph of the body, with paragraph_index recorded.
 *                Lets retrieval pull the most relevant fragments without
 *                drowning the prompt in irrelevant prose.
 */
import type { Story, Chunk } from "@roman/shared";

// The OpenAI embedding model (text-embedding-3-small) caps input at 8192
// tokens. We keep every chunk well under that in characters (~4 chars/token,
// so ~24k chars ≈ 6k tokens leaves comfortable margin). Long reference texts —
// Fowler's chapters, big Smith's entries — would otherwise blow the story-level
// chunk past the limit (as the oversized Meditations appendix once did).
const MAX_CHUNK_CHARS = 24000;

/** Truncate to the last sentence boundary within the limit (fallback: hard cut). */
function capLength(s: string): string {
  if (s.length <= MAX_CHUNK_CHARS) return s;
  const slice = s.slice(0, MAX_CHUNK_CHARS);
  const lastEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  return lastEnd > MAX_CHUNK_CHARS * 0.5 ? slice.slice(0, lastEnd + 1) : slice;
}

// Returns null when the full body is too long to embed as a single chunk —
// the per-paragraph chunks then carry retrieval, and the whole-body chunk is
// simply skipped rather than failing the embed run.
export function buildStoryChunk(story: Story): Chunk | null {
  const preface =
    `${story.title}\n` +
    `Source: ${story.source} (${story.source_url})\n` +
    (story.informant ? `Informant: ${story.informant}\n` : "") +
    (story.category ? `Category: ${story.category}\n` : "");
  const content = `${preface}\n${story.english_text}`;
  if (content.length > MAX_CHUNK_CHARS) return null;

  return {
    story_id: story.id,
    chunk_type: "story",
    content,
    paragraph_index: null,
  };
}

export function buildParagraphChunks(story: Story): Chunk[] {
  const paragraphs = story.english_text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40); // drop fragments

  return paragraphs.map((content, i) => ({
    story_id: story.id,
    chunk_type: "paragraph",
    content: capLength(content), // guard a rare over-long paragraph
    paragraph_index: i,
  }));
}

export function chunksFor(story: Story): Chunk[] {
  const story_chunk = buildStoryChunk(story);
  const paragraphs = buildParagraphChunks(story);
  return story_chunk ? [story_chunk, ...paragraphs] : paragraphs;
}

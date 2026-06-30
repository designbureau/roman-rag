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

export function buildStoryChunk(story: Story): Chunk {
  const preface =
    `${story.title}\n` +
    `Source: ${story.source} (${story.source_url})\n` +
    (story.informant ? `Informant: ${story.informant}\n` : "") +
    (story.category ? `Category: ${story.category}\n` : "");

  return {
    story_id: story.id,
    chunk_type: "story",
    content: `${preface}\n${story.english_text}`,
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
    content,
    paragraph_index: i,
  }));
}

export function chunksFor(story: Story): Chunk[] {
  return [buildStoryChunk(story), ...buildParagraphChunks(story)];
}

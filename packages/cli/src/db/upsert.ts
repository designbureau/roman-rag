import type { Story, Chunk } from "@roman/shared";
import type { Sql } from "./client.js";

const STORY_BATCH = 100;
const CHUNK_BATCH = 50;

export async function upsertStories(sb: Sql, stories: Story[]): Promise<void> {
  if (!stories.length) return;
  for (let i = 0; i < stories.length; i += STORY_BATCH) {
    const batch = stories.slice(i, i + STORY_BATCH).map((s) => ({
      id: s.id,
      source: s.source,
      source_url: s.source_url,
      title: s.title,
      author: s.author,
      is_reference: s.is_reference,
      informant: s.informant,
      category: s.category,
      cicero_ref: s.cicero_ref,
      page_range: s.page_range,
      english_text: s.english_text,
      footnotes: s.footnotes ?? null,
      latin_text: s.latin_text,
      mantis_cycle: s.mantis_cycle,
      canonical_story_group: s.canonical_story_group,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await sb.from("stories").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`upsertStories failed: ${error.message}`);
  }
}

export type ChunkWithEmbedding = Chunk & { embedding: number[] };

export async function upsertChunks(
  sb: Sql,
  chunks: ChunkWithEmbedding[],
): Promise<void> {
  if (!chunks.length) return;

  // PostgREST upsert with on_conflict requires the conflict columns to be a
  // UNIQUE/PK constraint. Our unique index uses
  //   coalesce(paragraph_index, -1)
  // — that's a functional index, not eligible for ON CONFLICT inference.
  //
  // So we delete existing chunks for the affected stories first, then insert.
  // The migrations and the chunks table use ON DELETE CASCADE on story_id,
  // and we cleared chunk rows before the embed run if needed.
  const storyIds = [...new Set(chunks.map((c) => c.story_id))];
  for (let i = 0; i < storyIds.length; i += 50) {
    const slice = storyIds.slice(i, i + 50);
    const { error } = await sb.from("chunks").delete().in("story_id", slice);
    if (error) throw new Error(`delete existing chunks failed: ${error.message}`);
  }

  for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
    const batch = chunks.slice(i, i + CHUNK_BATCH).map((c) => ({
      story_id: c.story_id,
      chunk_type: c.chunk_type,
      content: c.content,
      paragraph_index: c.paragraph_index,
      // pgvector accepts the bracketed string literal form via REST.
      embedding: `[${c.embedding.join(",")}]`,
    }));
    const { error } = await sb.from("chunks").insert(batch);
    if (error) throw new Error(`insert chunks failed: ${error.message}`);
  }
}

/**
 * Look up existing chunks (by composite key) and return their content for
 * change detection.
 */
export async function existingChunkContent(
  sb: Sql,
  storyIds: string[],
): Promise<Map<string, string>> {
  if (!storyIds.length) return new Map();
  const out = new Map<string, string>();
  for (let i = 0; i < storyIds.length; i += 100) {
    const slice = storyIds.slice(i, i + 100);
    const { data, error } = await sb
      .from("chunks")
      .select("story_id, chunk_type, paragraph_index, content")
      .in("story_id", slice);
    if (error) throw new Error(`existingChunkContent failed: ${error.message}`);
    for (const r of data ?? []) {
      const key = `${r.story_id}__${r.chunk_type}__${r.paragraph_index ?? -1}`;
      out.set(key, r.content as string);
    }
  }
  return out;
}

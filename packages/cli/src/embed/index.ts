/**
 * Embed pipeline.
 *
 * Reads data/stories.json, chunks each story (story-level + paragraph), embeds
 * any chunks whose content has changed (or that are new), and upserts.
 *
 * Idempotent: re-runs are no-ops when nothing has changed.
 *
 * Flags:
 *   --limit=N    only process the first N stories (smoke test)
 *   --dry-run    do everything except call OpenAI / write to DB
 */
import "../load-env.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import OpenAI from "openai";
import type { Story } from "@roman/shared";

import { chunksFor } from "./chunk.js";
import { makeCliClient } from "../db/client.js";
import {
  upsertStories,
  upsertChunks,
  existingChunkContent,
  type ChunkWithEmbedding,
} from "../db/upsert.js";

const STORIES_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data/stories.json",
);

const EMBED_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

type Args = { limit?: number; dryRun: boolean };

function parseArgs(argv: string[]): Args {
  let limit: number | undefined;
  let dryRun = false;
  for (const a of argv) {
    if (a.startsWith("--limit=")) limit = Number(a.slice("--limit=".length));
    if (a === "--dry-run") dryRun = true;
  }
  return { limit, dryRun };
}

async function main() {
  const { limit, dryRun } = parseArgs(process.argv.slice(2));

  const stories: Story[] = JSON.parse(await readFile(STORIES_FILE, "utf8"));
  const target = limit ? stories.slice(0, limit) : stories;
  console.log(`Stories: ${target.length}${limit ? ` (limited from ${stories.length})` : ""}`);

  const sql = makeCliClient();

  // Upsert stories first so chunks' FK is satisfied.
  if (!dryRun) {
    await upsertStories(sql, target);
    console.log(`✓ upserted ${target.length} stories`);
  }

  // Build all chunks and figure out which need (re-)embedding.
  type Pending = { storyId: string; chunkType: "story" | "paragraph"; paragraphIndex: number | null; content: string };
  const allPending: Pending[] = [];
  for (const story of target) {
    for (const c of chunksFor(story)) {
      allPending.push({
        storyId: c.story_id,
        chunkType: c.chunk_type,
        paragraphIndex: c.paragraph_index,
        content: c.content,
      });
    }
  }
  console.log(`Total chunks: ${allPending.length}`);

  // Diff against existing — skip unchanged content.
  const existing = await existingChunkContent(sql, target.map((s) => s.id));
  const toEmbed = allPending.filter((c) => {
    const key = `${c.storyId}__${c.chunkType}__${c.paragraphIndex ?? -1}`;
    const old = existing.get(key);
    return old !== c.content;
  });
  console.log(`Chunks needing embedding: ${toEmbed.length} (skipping ${allPending.length - toEmbed.length} unchanged)`);

  if (!toEmbed.length) {
    console.log("Nothing to do.");
      return;
  }

  if (dryRun) {
    console.log("[dry-run] would embed", toEmbed.length, "chunks");
      return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const embedded: ChunkWithEmbedding[] = [];
  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: batch.map((c) => c.content),
    });
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j]!;
      const vec = res.data[j]?.embedding;
      if (!vec) throw new Error(`Missing embedding for batch ${i + j}`);
      embedded.push({
        story_id: item.storyId,
        chunk_type: item.chunkType,
        paragraph_index: item.paragraphIndex,
        content: item.content,
        embedding: vec,
      });
    }
    console.log(`  embedded ${Math.min(i + BATCH_SIZE, toEmbed.length)}/${toEmbed.length}`);
  }

  await upsertChunks(sql, embedded);
  console.log(`✓ upserted ${embedded.length} chunks`);

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Retrieval eval harness.
 *
 * Loads eval/queries.json (each query plus the story ids that should come
 * back), embeds every query with the same model the chat function uses
 * (text-embedding-3-small), calls the `search_chunks` RPC exactly as chat
 * does, and reports Recall@K and MRR@K over the fixture. A case is a hit if
 * any of its `expect_story_ids` appears among the distinct stories in the
 * top-K retrieved chunks (K mirrors chat's match_count, default 10).
 *
 * Run:   pnpm eval            (repo root)
 *        pnpm --filter @roman/cli eval
 * Flags: --k=10
 *
 * This is the baseline gate for the retrieval roadmap (provenance chunking,
 * hybrid BM25, cross-encoder rerank). Record before/after on the same
 * fixture with every change; grow the fixture towards ~30 cases.
 */
import "../load-env.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import OpenAI from "openai";
import { makeCliClient } from "../db/client.js";

const EMBED_MODEL = "text-embedding-3-small";

type Case = { query: string; expect_story_ids: string[]; note?: string };

function parseK(argv: string[]): number {
  for (const a of argv) if (a.startsWith("--k=")) return Number(a.slice("--k=".length));
  return 10;
}

async function main() {
  const k = parseK(process.argv.slice(2));
  const fixturePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "queries.json",
  );
  const cases: Case[] = JSON.parse(await readFile(fixturePath, "utf8"));

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supa = makeCliClient();

  let hits = 0;
  let rrSum = 0;
  const rows: string[] = [];

  for (const c of cases) {
    const emb = await openai.embeddings.create({ model: EMBED_MODEL, input: c.query });
    const vec = emb.data[0]?.embedding;
    if (!vec) throw new Error(`no embedding for: ${c.query}`);

    const { data, error } = await supa.rpc("search_chunks", {
      query_embedding: `[${vec.join(",")}]`,
      match_count: k,
      filter_informant: null,
      filter_category: null,
      filter_source: null,
      filter_mantis: null,
    });
    if (error) throw new Error(`search_chunks: ${error.message}`);

    // Dedupe to distinct stories, preserving retrieval order.
    const stories: string[] = [];
    for (const r of (data ?? []) as Array<{ story_id: string }>) {
      if (!stories.includes(r.story_id)) stories.push(r.story_id);
    }
    const ranks = c.expect_story_ids
      .map((id) => stories.indexOf(id))
      .filter((i) => i >= 0)
      .map((i) => i + 1);
    const best = ranks.length ? Math.min(...ranks) : 0;
    const hit = best > 0;
    if (hit) {
      hits++;
      rrSum += 1 / best;
    }
    rows.push(`${hit ? "HIT " : "MISS"}  rank ${best || "-"}  ${c.query}`);
  }

  const n = cases.length;
  console.log(rows.join("\n"));
  console.log("");
  console.log(`Cases:     ${n}`);
  console.log(`Recall@${k}:  ${(hits / n).toFixed(3)} (${hits}/${n})`);
  console.log(`MRR@${k}:     ${(rrSum / n).toFixed(3)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Shared retrieval helper for the chat + search Edge Functions.
 *
 * Embeds the query via OpenAI and calls the search_chunks RPC. Both personas
 * use this with identical defaults — retrieval does NOT vary by persona
 * (personas brief lines 47, 322).
 */
import OpenAI from "npm:openai@4";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type SearchResult = {
  chunk_id: string;
  story_id: string;
  story_title: string;
  source: string;
  informant: string | null;
  category: string | null;
  mantis_cycle: boolean;
  chunk_type: "story" | "paragraph";
  content: string;
  source_url: string;
  latin_text: string | null;
  similarity: number;
};

export type RetrievalFilters = {
  informant?: string;
  category?: string;
  source?: string;
  mantisCycle?: boolean;
  matchCount?: number;
};

let _supabase: SupabaseClient | null = null;
let _openai: OpenAI | null = null;

function supabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

function openai(): OpenAI {
  if (_openai) return _openai;
  _openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });
  return _openai;
}

export async function embed(query: string): Promise<number[]> {
  const res = await openai().embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const vec = res.data[0]?.embedding;
  if (!vec) throw new Error("embed: missing embedding");
  return vec;
}

export async function retrieve(
  query: string,
  filters: RetrievalFilters = {},
): Promise<SearchResult[]> {
  const queryEmbedding = await embed(query);
  const { data, error } = await supabase().rpc("search_chunks", {
    query_embedding: `[${queryEmbedding.join(",")}]`,
    match_count: filters.matchCount ?? 10,
    filter_informant: filters.informant ?? null,
    filter_category: filters.category ?? null,
    filter_source: filters.source ?? null,
    filter_mantis: filters.mantisCycle ?? null,
  });
  if (error) throw new Error(`search_chunks RPC failed: ${error.message}`);
  return (data ?? []) as SearchResult[];
}

/**
 * /functions/search — thin wrapper over the search_chunks RPC.
 *
 * POST { query, matchCount?, informant?, category?, source?, mantisCycle? }
 *   → { results: SearchResult[] }
 *
 * Intended for filter previews and any non-chat UI surface.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS_HEADERS, corsPreflight } from "../_shared/cors.ts";
import { retrieve, type RetrievalFilters } from "../_shared/retrieve.ts";

type Body = {
  query: string;
} & RetrievalFilters;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.query || typeof body.query !== "string") {
    return json({ error: "query is required" }, 400);
  }

  try {
    const results = await retrieve(body.query, {
      matchCount: body.matchCount ?? 10,
      informant: body.informant,
      category: body.category,
      source: body.source,
      mantisCycle: body.mantisCycle,
    });
    return json({ results });
  } catch (err) {
    console.error("search failed:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

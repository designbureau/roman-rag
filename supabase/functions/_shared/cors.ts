/**
 * CORS for the chat + search Edge Functions. Permissive by design — this
 * project is a private prototype and the functions sit behind anon JWT
 * verification (set in supabase/config.toml).
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function corsPreflight(): Response {
  return new Response("ok", { headers: CORS_HEADERS });
}

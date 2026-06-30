import "../load-env.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

/**
 * CLI uses the Supabase REST client with service_role to bypass RLS.
 * REST avoids the pooler-region/IPv6 mess of direct Postgres connections
 * and is fast enough for 100s of stories — bulk insert with `.upsert()`
 * is one HTTP roundtrip per ~100 rows.
 */
export function makeCliClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Sql = SupabaseClient;

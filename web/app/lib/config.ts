/**
 * Frontend config — exposed at build time via Vite envs.
 *
 * NEXT_PUBLIC_* names are kept for parity with the original brief; RR7 +
 * Vite uses VITE_* by convention. We accept either.
 */
function readEnv(...names: string[]): string {
  for (const name of names) {
    // Vite injects import.meta.env at build time.
    const v = (import.meta.env as Record<string, string | undefined>)[name];
    if (v) return v;
  }
  return "";
}

export const SUPABASE_URL = readEnv(
  "VITE_SUPABASE_URL",
  "VITE_PUBLIC_SUPABASE_URL",
);

export const SUPABASE_ANON_KEY = readEnv(
  "VITE_SUPABASE_ANON_KEY",
  "VITE_PUBLIC_SUPABASE_ANON_KEY",
);

export const CHAT_FN_URL =
  readEnv("VITE_CHAT_FN_URL") ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/chat` : "");

export const SEARCH_FN_URL =
  readEnv("VITE_SEARCH_FN_URL") ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/search` : "");

export const SPEAK_FN_URL =
  readEnv("VITE_SPEAK_FN_URL") ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/speak` : "");

export const TRANSCRIBE_FN_URL =
  readEnv("VITE_TRANSCRIBE_FN_URL") ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/transcribe` : "");

/**
 * Master switch for the view-locking auth gate. While `false` the
 * gate renders children unconditionally everywhere (dev AND prod).
 * Flip back to `true` to require sign-in on the deployed build.
 *
 * All the auth plumbing (Supabase client, AuthProvider, sign-in
 * methods) stays mounted and live regardless — this only controls
 * whether the gate component blocks rendering.
 *
 * Currently FALSE for the vertical slice: there is no auth/profiles
 * setup yet (the profiles + persona_config migrations are deferred),
 * so the site is open and the /admin route stays effectively disabled
 * (it needs a signed-in is_admin user). Flip back to `true` once the
 * auth layer lands.
 */
export const AUTH_ENABLED = false;

/**
 * Skip the auth gate when running under `pnpm dev` (Vite sets
 * `import.meta.env.DEV === true`). The deployed Vercel build is
 * gated only when AUTH_ENABLED is also true. The Edge Functions
 * are not touched by auth — only the view is locked.
 */
export const IS_DEV_BYPASS =
  (import.meta.env as { DEV?: boolean }).DEV === true;

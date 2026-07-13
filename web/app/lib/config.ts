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
 * Master switch for the auth gate. The site itself is public (gallery,
 * chat, papers); the gate wraps only the /admin route, so with this
 * `true` reaching the persona editor requires a signed-in user whose
 * profile row has `is_admin = true` (see routes/admin.tsx). While
 * `false` the gate renders children unconditionally and /admin is
 * open — dev-prototype behaviour only.
 *
 * Sign-in is invite-only: Supabase signups are disabled in the
 * dashboard and signInWithOtp passes shouldCreateUser: false, so a
 * magic link is only ever issued to users created via the dashboard.
 */
export const AUTH_ENABLED = true;

/**
 * Skip the auth gate when running under `pnpm dev` (Vite sets
 * `import.meta.env.DEV === true`). The deployed Vercel build is
 * gated only when AUTH_ENABLED is also true. The Edge Functions
 * are not touched by auth — only the view is locked.
 */
export const IS_DEV_BYPASS =
  (import.meta.env as { DEV?: boolean }).DEV === true;

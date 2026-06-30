/**
 * Browser-side Supabase client. Single shared instance — the SDK
 * persists the session to localStorage, attaches an auto-refresh
 * timer for the access token, and exposes the auth event stream that
 * the `useAuth` hook subscribes to.
 *
 * We intentionally instantiate ONCE at module load. Creating the
 * client per render would lose the session listener and leak timers.
 */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

/**
 * In-process auth lock.
 *
 * supabase-js defaults to a cross-tab lock built on the Web Locks API
 * (navigator.locks). On a page reload when a stored session exists, that
 * lock can deadlock: getSession() waits on a named lock that is never
 * released, so it never resolves and the auth gate sits on "Loading…"
 * forever. (A fresh incognito tab has no stored session, so the path is
 * never hit, which is why it loads there.)
 *
 * This replacement serialises auth operations within the current tab only
 * (a per-name promise chain, equivalent to auth-js's own processLock),
 * which is sufficient for a single-tab SPA and cannot deadlock across
 * reloads. Defined inline rather than imported from @supabase/auth-js,
 * which is only a transitive dependency.
 */
const lockChains = new Map<string, Promise<unknown>>();
function inProcessLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const prev = lockChains.get(name) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  // Keep the chain alive but never let a rejection break the next waiter.
  lockChains.set(
    name,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE is the recommended flow for SPAs — exchanges the auth code
    // for tokens client-side without exposing a long-lived secret.
    flowType: "pkce",
    // Avoid the navigator.locks-based cross-tab lock (see above).
    lock: inProcessLock,
  },
});

/**
 * Auth context + hook. Tracks the Supabase session and exposes the
 * current user + access token.
 *
 * Listens to `onAuthStateChange`, mirrors the session into React
 * state, and surfaces `signInWithGoogle` / `signInWithMagicLink` /
 * `signOut` for the gate component to call.
 *
 * No domain restriction is applied — any signed-in Supabase user is
 * treated as authorised. If we later want to gate by email domain
 * the check belongs in `apply()`; see git history for the previous
 * Swanky-only implementation.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthStatus = "loading" | "signed-out" | "signed-in";

type AuthState = {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  /** True when the signed-in user's profile has is_admin = true. */
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  /**
   * Email-OTP sign-in. Returns `{ ok }` on success so the gate can
   * show "check your inbox", or `{ ok: false, error }` on Supabase
   * failure.
   */
  signInWithMagicLink: (
    email: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const apply = useCallback((session: Session | null) => {
    if (!session) {
      setUser(null);
      setAccessToken(null);
      setIsAdmin(false);
      setStatus("signed-out");
      return;
    }
    setUser(session.user);
    setAccessToken(session.access_token);
    setStatus("signed-in");
    // Resolve the admin flag from the profile row (RLS lets a user read
    // only their own). Fire-and-forget; defaults to non-admin on error.
    supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(
        ({ data }) => setIsAdmin(Boolean(data?.is_admin)),
        () => setIsAdmin(false),
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Resolve the initial session. Two failure modes are guarded so the
    // gate can never hang on "loading" forever (which renders as a stuck
    // loading screen): a rejected promise, and a getSession() that never
    // settles. In both cases we fall back to signed-out so the user gets
    // the sign-in card and can act, rather than an infinite spinner.
    // onAuthStateChange still fires for any real session that arrives
    // later (e.g. a slow token refresh), promoting the gate to signed-in.
    const settle = (session: Session | null) => {
      if (cancelled) return;
      clearTimeout(timer);
      apply(session);
    };
    const timer = setTimeout(() => {
      if (cancelled) return;
      setStatus((s) => (s === "loading" ? "signed-out" : s));
    }, 8000);
    supabase.auth
      .getSession()
      .then(({ data }) => settle(data.session))
      .catch(() => settle(null));
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        clearTimeout(timer);
        apply(session);
      },
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [apply]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
  }, []);

  const signInWithMagicLink = useCallback(
    async (
      rawEmail: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      const email = rawEmail.trim().toLowerCase();
      if (!email) return { ok: false, error: "Enter your email address." };
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
        },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      accessToken,
      isAdmin,
      signInWithGoogle,
      signInWithMagicLink,
      signOut,
    }),
    [
      status,
      user,
      accessToken,
      isAdmin,
      signInWithGoogle,
      signInWithMagicLink,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth used outside AuthProvider");
  return v;
}

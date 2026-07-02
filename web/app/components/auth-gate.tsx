/**
 * Auth gate. Wraps the app's authenticated surface. Three states:
 *
 *   - loading: render a quiet placeholder while we wait for Supabase
 *     to tell us whether a session exists.
 *   - signed-out: render the sign-in card.
 *   - signed-in: render the children.
 *
 * Visual language matches the rest of the site (warm ivory, serif
 * display heading, no shadows, hairline borders).
 */
import { useState } from "react";
import { useAuth } from "~/lib/auth";
import { AUTH_ENABLED, IS_DEV_BYPASS } from "~/lib/config";

// Toggles for which sign-in methods are visible. The other plumbing
// stays live in `lib/auth.tsx` so flipping a flag here is the only
// change needed to swap which option(s) users see.
const SHOW_GOOGLE_SIGN_IN = true;
const SHOW_MAGIC_LINK = true;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, signInWithGoogle, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [linkState, setLinkState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; to: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Master kill-switch + dev bypass. While AUTH_ENABLED is false
  // the gate is fully transparent everywhere; the dev bypass keeps
  // the same shortcut available even when auth is re-enabled.
  if (!AUTH_ENABLED || IS_DEV_BYPASS) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-[color:var(--muted-foreground)]">
          Loading…
        </p>
      </div>
    );
  }

  if (status === "signed-in") {
    return <>{children}</>;
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (linkState.kind === "sending") return;
    setLinkState({ kind: "sending" });
    const res = await signInWithMagicLink(email);
    if (res.ok) {
      setLinkState({ kind: "sent", to: email.trim().toLowerCase() });
    } else {
      setLinkState({ kind: "error", message: res.error });
    }
  };

  // signed-out → minimal sign-in card.
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-8 text-center">
        <h1 className="font-display text-3xl sm:text-4xl">
          The Roman Archive
        </h1>

        {SHOW_MAGIC_LINK && linkState.kind === "sent" ? (
          <>
            <p className="mt-4 text-sm">
              Check your inbox at{" "}
              <span className="font-mono">{linkState.to}</span> for a sign-in
              link.
            </p>
            <button
              type="button"
              onClick={() => {
                setLinkState({ kind: "idle" });
                setEmail("");
              }}
              className="mt-4 text-xs text-[color:var(--muted-foreground)] underline hover:text-[color:var(--accent)]"
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
              Sign in to continue.
            </p>

            {SHOW_MAGIC_LINK && (
              <form
                onSubmit={onSubmit}
                className="mt-5 flex flex-col items-stretch gap-3 text-left"
              >
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[color:var(--muted-foreground)]">
                    Email
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (linkState.kind === "error")
                        setLinkState({ kind: "idle" });
                    }}
                    placeholder="your email"
                    className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={linkState.kind === "sending"}
                  className="inline-flex items-center justify-center rounded-md border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-5 py-2.5 text-sm font-medium text-[color:var(--background)] transition-colors hover:bg-[color:var(--background)] hover:text-[color:var(--foreground)] disabled:opacity-60"
                >
                  {linkState.kind === "sending" ? "Sending…" : "Email me a link"}
                </button>
                {linkState.kind === "error" && (
                  <p className="text-xs text-[color:var(--accent)]">
                    {linkState.message}
                  </p>
                )}
              </form>
            )}

            {SHOW_MAGIC_LINK && SHOW_GOOGLE_SIGN_IN && (
              // Hairline "or" rule only when both methods are visible.
              <div className="mt-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
                <span className="h-px flex-1 bg-[color:var(--border)]" />
                or
                <span className="h-px flex-1 bg-[color:var(--border)]" />
              </div>
            )}

            {SHOW_GOOGLE_SIGN_IN && (
              <button
                type="button"
                onClick={() => {
                  void signInWithGoogle();
                }}
                className={
                  // When Google is the only sign-in method it gets the
                  // primary (filled) style; otherwise it sits below the
                  // email form as a secondary (outline) action.
                  SHOW_MAGIC_LINK
                    ? "mt-4 inline-flex w-full items-center justify-center gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-5 py-2.5 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:border-[color:var(--foreground)]"
                    : "mt-6 inline-flex w-full items-center justify-center gap-3 rounded-md border border-[color:var(--foreground)] bg-[color:var(--background)] px-5 py-2.5 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
                }
              >
                <GoogleGlyph />
                Sign in with Google
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function GoogleGlyph() {
  // Multi-colour Google G mark — minimal inline SVG so we don't pull
  // in another asset file. Sizing matches the button's text height.
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Synchronous read of the user's reduced-motion preference. Safe on the
 * server (returns false) and cheap enough to call at the top of an effect
 * that only runs once. For anything that must react to the setting changing
 * mid-session, use the hook below instead.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Reactive reduced-motion preference. Re-renders the caller if the OS
 * setting changes while the page is open. Starts false during SSR so the
 * first client render matches, then corrects on mount.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

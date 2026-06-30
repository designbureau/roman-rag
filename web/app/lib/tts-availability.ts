/**
 * Cross-component signal for whether the ElevenLabs TTS backend is
 * actually serving audio.
 *
 * Starts as "unknown". Set to "available" the first time a PlayButton
 * gets a successful audio response, or "unavailable" when one returns a
 * non-OK status (or any error). PlayButton renders null when status is
 * "unavailable" — no fallback, no system-voice playback.
 *
 * Reset on full page reload. There's no localStorage persistence: when
 * the user upgrades ElevenLabs and reloads, buttons reappear without
 * needing to clear anything.
 */

import { useSyncExternalStore } from "react";

export type TtsStatus = "unknown" | "available" | "unavailable";

let status: TtsStatus = "unknown";
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function getTtsStatus(): TtsStatus {
  return status;
}

export function setTtsStatus(next: TtsStatus): void {
  if (status === next) return;
  status = next;
  notify();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useTtsStatus(): TtsStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => "unknown",
  );
}

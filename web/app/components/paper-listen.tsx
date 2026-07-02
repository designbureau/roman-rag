import { useEffect, useRef, useState } from "react";
import { SPEAK_FN_URL } from "~/lib/config";
import { SUPABASE_ANON_KEY } from "~/lib/config";

/**
 * "Listen" control for the long-form paper pages, via ElevenLabs.
 *
 * The paper is split into sections (segments under the /speak input cap), each
 * synthesised by the shared /speak Edge Function (which normalises the text,
 * drops bracketed citations, and resolves a narrator voice). Rather than one
 * giant blob, segments play through a single audio element as a queue: while
 * one section plays, the next is pre-fetched, so playback flows continuously
 * from section to section without a gap.
 *
 * The reference list is skipped (reading URLs aloud is tedious). Controls are
 * Listen / Pause / Resume / Stop; a small label shows progress.
 */

// Narrator voice. /speak resolves this persona to a voice; the Classicist is
// a warm, measured narrator, which suits the papers.
const NARRATOR_PERSONA = "classicist";
// Keep each segment under /speak's 4000-char input cap, with headroom for the
// click-stripping / pronunciation expansion it applies server-side.
const MAX_SEG_CHARS = 3200;

type ListenState = "idle" | "loading" | "playing" | "paused" | "error";

function buildSegments(root: HTMLElement | null): string[] {
  if (!root) return [];
  let text = root.innerText ?? "";
  // Stop at the bibliography (and the appendices after it).
  const refMatch = text.match(/\n\s*References\s*\n/);
  if (refMatch && refMatch.index !== undefined) text = text.slice(0, refMatch.index);

  const blocks = text
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const segs: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) segs.push(cur.trim());
    cur = "";
  };
  for (const block of blocks) {
    if (block.length > MAX_SEG_CHARS) {
      // A single block longer than the cap: split it at sentence boundaries.
      flush();
      const sentences = block.match(/[^.!?]+[.!?]*/g) ?? [block];
      let s = "";
      for (const sent of sentences) {
        if ((s + sent).length > MAX_SEG_CHARS) {
          if (s.trim()) segs.push(s.trim());
          s = sent;
        } else {
          s += sent;
        }
      }
      if (s.trim()) segs.push(s.trim());
    } else if ((cur + "\n\n" + block).length > MAX_SEG_CHARS) {
      flush();
      cur = block;
    } else {
      cur = cur ? cur + "\n\n" + block : block;
    }
  }
  flush();
  return segs;
}

export function PaperListen({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
}) {
  const [state, setState] = useState<ListenState>("idle");
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segsRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const inflightRef = useRef<Map<number, Promise<string>>>(new Map());
  // Generation counter: bumped on stop/restart so stale async callbacks
  // (a fetch that resolves after the user hit Stop) can detect they're
  // obsolete and bail.
  const runRef = useRef(0);

  const revokeAll = () => {
    for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
    cacheRef.current.clear();
    inflightRef.current.clear();
  };

  useEffect(() => {
    return () => {
      runRef.current++;
      audioRef.current?.pause();
      revokeAll();
    };
  }, []);

  const fetchSeg = (i: number): Promise<string> => {
    const cached = cacheRef.current.get(i);
    if (cached) return Promise.resolve(cached);
    const inflight = inflightRef.current.get(i);
    if (inflight) return inflight;
    const p = (async () => {
      const res = await fetch(SPEAK_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ text: segsRef.current[i], persona: NARRATOR_PERSONA }),
      });
      if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try {
          const j = await res.json();
          if (j.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      const payload = (await res.json()) as { audio: string; mime?: string };
      const bytes = Uint8Array.from(atob(payload.audio), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], { type: payload.mime || "audio/mpeg" }),
      );
      cacheRef.current.set(i, url);
      return url;
    })();
    inflightRef.current.set(i, p);
    p.catch(() => {}).finally(() => inflightRef.current.delete(i));
    return p;
  };

  const playSeg = async (i: number, run: number) => {
    if (run !== runRef.current) return;
    if (i >= segsRef.current.length) {
      setState("idle");
      setCurrent(0);
      return;
    }
    let url: string;
    try {
      url = await fetchSeg(i);
    } catch (err) {
      if (run === runRef.current) {
        setError((err as Error).message);
        setState("error");
      }
      return;
    }
    if (run !== runRef.current) return;
    idxRef.current = i;
    setCurrent(i);
    const audio = audioRef.current!;
    audio.src = url;
    void audio.play().catch(() => {});
    setState("playing");
    // Look ahead: pre-fetch the next section now, so it's buffered and ready
    // before this one ends.
    if (i + 1 < segsRef.current.length) fetchSeg(i + 1).catch(() => {});
  };

  const start = () => {
    const segs = buildSegments(targetRef.current);
    if (!segs.length) return;
    runRef.current++;
    const run = runRef.current;
    audioRef.current?.pause();
    revokeAll();
    segsRef.current = segs;
    idxRef.current = 0;
    setTotal(segs.length);
    setCurrent(0);
    setError(null);
    if (!audioRef.current) {
      const audio = new Audio();
      audio.onended = () => {
        if (audioRef.current) void playSeg(idxRef.current + 1, runRef.current);
      };
      audioRef.current = audio;
    }
    setState("loading");
    void playSeg(0, run);
  };

  const pause = () => {
    audioRef.current?.pause();
    setState("paused");
  };
  const resume = () => {
    void audioRef.current?.play().catch(() => {});
    setState("playing");
  };
  const stop = () => {
    runRef.current++;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    revokeAll();
    idxRef.current = 0;
    setCurrent(0);
    setState("idle");
  };

  const btn =
    "rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2.5 py-1 text-sm text-[color:var(--foreground)] transition-colors hover:border-[color:var(--foreground)]";
  const label = "text-xs text-[color:var(--muted-foreground)]";

  return (
    <span className="inline-flex items-center gap-2">
      {state === "idle" && (
        <button type="button" onClick={start} className={btn} aria-label="Read this paper aloud">
          ▶ Listen
        </button>
      )}
      {state === "loading" && (
        <span className={label} aria-live="polite">
          Loading audio…
        </span>
      )}
      {(state === "playing" || state === "paused") && (
        <>
          {state === "playing" ? (
            <button type="button" onClick={pause} className={btn}>
              ❙❙ Pause
            </button>
          ) : (
            <button type="button" onClick={resume} className={btn}>
              ▶ Resume
            </button>
          )}
          <button type="button" onClick={stop} className={btn}>
            ■ Stop
          </button>
          {total > 0 && (
            <span className={label}>
              §{current + 1}/{total}
            </span>
          )}
        </>
      )}
      {state === "error" && (
        <>
          <span className={label} role="alert">
            Audio unavailable{error ? `: ${error}` : ""}.
          </span>
          <button type="button" onClick={start} className={btn}>
            Retry
          </button>
        </>
      )}
    </span>
  );
}

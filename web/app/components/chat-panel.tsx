import { useChat } from "@ai-sdk/react";
import { useMemo, useRef, useEffect, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Button } from "./ui/button";
import { CitationsPanel, type RetrievedChunk, type RelatedImage, type NotebookPage } from "./citations-panel";
import type { Persona } from "./persona-toggle";
import type { RetrievalFilters } from "./filter-bar";
import { CHAT_FN_URL, SPEAK_FN_URL, SUPABASE_ANON_KEY, TRANSCRIBE_FN_URL } from "~/lib/config";
import { setTtsStatus, useTtsStatus } from "~/lib/tts-availability";
import { rehypeWordSpans } from "~/lib/rehype-word-spans";
import { rehypeGlossaryTooltip } from "~/lib/rehype-glossary-tooltip";
import { GlossaryPopover } from "./glossary-popover";

export function ChatPanel({
  persona,
  personaTitle,
  retrievalFilters,
  initialInput,
  tier,
}: {
  persona: Persona;
  /** Display title for the current persona (from persona_config.title). */
  personaTitle: string;
  retrievalFilters: RetrievalFilters;
  initialInput?: string;
  /** Selected persona tier key (e.g. the Storyteller age tier). */
  tier?: string;
}) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, data, setMessages, setInput, append } =
    useChat({
      api: CHAT_FN_URL,
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: {
        persona,
        retrievalFilters,
        tier,
      },
      initialInput,
    });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Stick to the bottom whenever the message stream updates — including on
  // every chunk during streaming (useChat passes a fresh messages array on
  // each delta). We also track whether the user has manually scrolled up;
  // if they have, we stop auto-following until they scroll back near the
  // bottom themselves.
  const stickToBottomRef = useRef(true);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });
  // Note: no deps — fires every render. The cost is one DOM read/write per
  // render, which is negligible. This catches both new messages and
  // streaming-character updates inside the last assistant message.

  // Pull retrievedChunks + the related image out of the AI SDK data
  // stream. The chat function appends
  // `{ retrievedChunks, relatedImage, notebookPage, persona }`
  // once per turn.
  const lastTurnData = useMemo<{
    chunks: RetrievedChunk[];
    image: RelatedImage | null;
    notebookPage: NotebookPage | null;
  }>(() => {
    if (!data) return { chunks: [], image: null, notebookPage: null };
    for (let i = data.length - 1; i >= 0; i--) {
      const item = data[i] as
        | {
            retrievedChunks?: RetrievedChunk[];
            relatedImage?: RelatedImage | null;
            notebookPage?: NotebookPage | null;
          }
        | unknown;
      if (item && typeof item === "object" && "retrievedChunks" in item) {
        const it = item as {
          retrievedChunks: RetrievedChunk[];
          relatedImage?: RelatedImage | null;
          notebookPage?: NotebookPage | null;
        };
        return {
          chunks: it.retrievedChunks ?? [],
          image: it.relatedImage ?? null,
          notebookPage: it.notebookPage ?? null,
        };
      }
    }
    return { chunks: [], image: null, notebookPage: null };
  }, [data]);
  const lastRetrieved = lastTurnData.chunks;
  const lastImage = lastTurnData.image;
  const lastNotebookPage = lastTurnData.notebookPage;

  const lastAssistant =
    [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";

  const configIssue =
    !CHAT_FN_URL || !SUPABASE_ANON_KEY
      ? "Frontend env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (and optionally VITE_CHAT_FN_URL) in .env.local before running pnpm dev."
      : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex h-[65vh] flex-col overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--background)] sm:h-[70vh]">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 space-y-6 overflow-y-auto px-4 py-6"
        >
          {configIssue && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm">
              {configIssue}
            </div>
          )}
          {messages.length === 0 && !configIssue && (
            <div className="rounded-md border border-dashed border-[color:var(--border)] p-6 text-sm text-[color:var(--muted-foreground)]">
              Ask {personaTitle} something.{" "}
              Try: <em className="font-corpus">tell me about the eland</em>,{" "}
              <em className="font-corpus">what does the archive say about the moon</em>,{" "}
              <em className="font-corpus">who was ǁkabbo</em>.
            </div>
          )}
          {messages.map((m) => {
            const streaming = isLoading && m === messages[messages.length - 1];
            // While we wait on the first token the assistant message is
            // still empty — the thinking indicator below stands in for it,
            // so skip the empty bubble to avoid a blank box.
            if (m.role === "assistant" && streaming && !m.content.trim()) {
              return null;
            }
            return (
              <Message
                key={m.id}
                role={m.role}
                content={m.content}
                persona={persona}
                isStreaming={streaming}
                onStorySelect={(title) =>
                  append({ role: "user", content: `read me "${title}"` })
                }
              />
            );
          })}
          {/* Waiting on a response: shown after the user sends, through
              retrieval and up to the first streamed token, then replaced by
              the streaming reply. */}
          {(() => {
            const last = messages[messages.length - 1];
            const waiting =
              isLoading &&
              (!last || last.role !== "assistant" || !last.content.trim());
            return waiting ? <ThinkingIndicator /> : null;
          })()}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex shrink-0 items-center gap-1.5 border-t border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 sm:gap-2 sm:px-4"
          suppressHydrationWarning
        >
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={`Ask ${personaTitle}…`}
            className="min-w-0 flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]"
            disabled={isLoading || !!configIssue}
            suppressHydrationWarning
            autoComplete="off"
            data-form-type="other"
          />
          <MicButton
            disabled={isLoading || !!configIssue}
            onTranscript={(text) => {
              setInput(input ? `${input} ${text}`.trim() : text);
            }}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim() || !!configIssue}
            className="shrink-0"
          >
            {isLoading ? "…" : "Send"}
          </Button>
          {messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMessages([])}
              disabled={isLoading}
              title="New conversation"
              aria-label="New conversation"
              className="shrink-0 px-2 sm:px-3"
            >
              {/* Icon-only on phones to keep the input wide enough to
                  read what you're typing. Full label returns at ≥sm. */}
              <span className="sm:hidden" aria-hidden>
                ×
              </span>
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </form>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start lg:max-h-[70vh] lg:overflow-y-auto">
        <CitationsPanel
          chunks={lastRetrieved}
          image={lastImage}
          notebookPage={lastNotebookPage}
          responseText={lastAssistant}
          persona={persona}
        />
      </div>
    </div>
  );
}

// Thinking indicator: cycle through the |xam click symbols (ǀ ǁ ǃ ǂ) in
// the warm accent while a reply is pending (retrieval + first token),
// then replaced by the streaming text. The `key` remount replays a small
// pop on each glyph change.
// The five clicks of the Bleek-Lloyd notation: dental, lateral, alveolar,
// palatal, and the bilabial ʘ ("sounds like a kiss").
const CLICK_GLYPHS = ["ǀ", "ǁ", "ǃ", "ǂ", "ʘ"] as const;
function ThinkingIndicator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setI((n) => (n + 1) % CLICK_GLYPHS.length),
      360,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className="flex h-4 items-center justify-start"
      role="status"
      aria-label="Thinking"
    >
      <span
        key={i}
        aria-hidden
        style={{ animation: "clickpop 360ms ease-out" }}
        className="select-none text-sm font-semibold leading-none text-[color:var(--accent)]"
      >
        {CLICK_GLYPHS[i]}
      </span>
      <style>{`@keyframes clickpop{0%{opacity:.15;transform:translateY(2px) scale(.8)}55%{opacity:1;transform:translateY(0) scale(1.08)}100%{opacity:1;transform:scale(1)}}`}</style>
      <span className="sr-only">Thinking…</span>
    </div>
  );
}

function Message({
  role,
  content,
  persona,
  isStreaming,
  onStorySelect,
}: {
  role: "user" | "assistant" | "system" | "data";
  content: string;
  persona: Persona;
  isStreaming: boolean;
  onStorySelect?: (title: string) => void;
}) {
  const isUser = role === "user";

  // Word-colour highlight, driven by PlayButton's activeWord callback.
  // We toggle a class on the matching <span data-w="N"> imperatively
  // (no React re-render at the audio frame rate). The CSS transition on
  // `color` handles both the fade-in to the highlight tint and the fade
  // back to base when the active word advances — fast and subtle.
  const [activeWord, setActiveWord] = useState<number>(-1);
  const proseRef = useRef<HTMLDivElement>(null);
  const activeElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = proseRef.current;
    if (!root) return;
    // Clear the previously-active span — its CSS transition fades it
    // back to the base text colour.
    if (activeElRef.current) {
      activeElRef.current.classList.remove("word-active");
      activeElRef.current = null;
    }
    if (activeWord < 0) return;
    const target = root.querySelector<HTMLElement>(`[data-w="${activeWord}"]`);
    if (!target) return;
    target.classList.add("word-active");
    activeElRef.current = target;
  }, [activeWord]);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] sm:max-w-[80%] rounded-lg bg-[color:var(--foreground)] px-4 py-3 text-[color:var(--background)]">
          <p>{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] sm:max-w-[80%] rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3">
        <div
          ref={proseRef}
          className="font-corpus text-base leading-relaxed prose-highlight [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_em]:italic"
        >
          <ReactMarkdown
            rehypePlugins={[rehypeWordSpans, rehypeGlossaryTooltip]}
            // Pass through our custom `story:` scheme — ReactMarkdown's
            // default urlTransform strips anything that isn't http(s),
            // mailto, etc., which would silently zero out the storyteller's
            // suggested-next-story links.
            urlTransform={(url) =>
              url.startsWith("story:") ? url : defaultUrlTransform(url)
            }
            components={{
              // Glossary spans (added by rehype-glossary-tooltip with
              // class="glossary-term" and a `title` carrying the gloss)
              // get upgraded into Radix popovers. Plain word-spans
              // (just `data-w`) pass through untouched. We detect by
              // className rather than data-attribute so the karaoke
              // hook in this file keeps working unchanged.
              span: ({
                node: _node,
                className,
                title,
                children,
                ...rest
              }: React.HTMLAttributes<HTMLSpanElement> & {
                node?: unknown;
              }) => {
                const isGlossary =
                  typeof className === "string" &&
                  className.split(/\s+/).includes("glossary-term") &&
                  typeof title === "string" &&
                  title.length > 0;
                if (isGlossary) {
                  // Pull the canonical term out of the children — it's
                  // the visible text of the span. Used as a small
                  // mono-cap header in the popover so the user sees
                  // what they tapped.
                  const term =
                    typeof children === "string"
                      ? children
                      : Array.isArray(children)
                        ? children.filter((c) => typeof c === "string").join("")
                        : undefined;
                  return (
                    <GlossaryPopover gloss={title!} term={term}>
                      <span className={className} {...rest}>
                        {children}
                      </span>
                    </GlossaryPopover>
                  );
                }
                return (
                  <span className={className} title={title} {...rest}>
                    {children}
                  </span>
                );
              },
              // `node` is a ReactMarkdown-internal prop that mustn't reach
              // the DOM; destructure it out (and any other non-HTML extras)
              // before spreading. `title` is preserved — the glossary
              // tooltip plugin sets it on inline spans, not on anchors,
              // but the contract is the same shape either way.
              a: ({ href, children, node: _node, ...rest }) => {
                if (typeof href === "string" && href.startsWith("story:")) {
                  // ReactMarkdown URL-encodes the href path, so a title
                  // with spaces or punctuation arrives as %20 / %21 etc.
                  // Decode before handing it off to the chat round —
                  // otherwise the LLM sees a literal "%20"-laden string
                  // and can't match it against the corpus.
                  const raw = href.slice("story:".length).trim();
                  let title = raw;
                  try {
                    title = decodeURIComponent(raw);
                  } catch {
                    // malformed escape — fall back to the raw string
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => onStorySelect?.(title)}
                      className="story-suggestion"
                    >
                      {children}
                    </button>
                  );
                }
                // Explicit onClick + window.open fallback: ReactMarkdown
                // wraps the link text in our karaoke `<span data-w>`
                // children, and on some setups the synthesised click on
                // the inner span never reaches the anchor's default
                // navigation. Forcing window.open here makes the link
                // reliably clickable regardless.
                const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                  if (e.defaultPrevented) return;
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
                    return;
                  if (typeof href === "string" && /^https?:/i.test(href)) {
                    e.preventDefault();
                    window.open(href, "_blank", "noopener,noreferrer");
                  }
                };
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onClick}
                    {...rest}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {!isStreaming && content.trim().length > 0 && (
          <PlayButton
            text={content}
            persona={persona}
            onWordChange={setActiveWord}
          />
        )}
      </div>
    </div>
  );
}

type PlayState = "idle" | "loading" | "playing" | "paused" | "error";

type WordTiming = {
  /** Index in the rendered message's [data-w] word spans. Bracketed
   *  words have no timing entry, so spoken indices skip them. */
  index: number;
  start: number;
  end: number;
  text: string;
};

function PlayButton({
  text,
  persona,
  onWordChange,
}: {
  text: string;
  persona: Persona;
  onWordChange?: (index: number) => void;
}) {
  const ttsStatus = useTtsStatus();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const wordsRef = useRef<WordTiming[]>([]);
  const lastWordIdxRef = useRef<number>(-1);
  const [state, setState] = useState<PlayState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Once any PlayButton in the page learns that ElevenLabs is unavailable,
  // hide all of them. Reset by reloading the page.
  if (ttsStatus === "unavailable") return null;

  const updateActiveWord = (currentTime: number) => {
    const words = wordsRef.current;
    if (!words.length) return;
    // Linear scan from last array position — audio time advances
    // monotonically so typically only one or two words to skip per tick.
    let i = Math.max(0, lastWordIdxRef.current);
    if (i >= words.length || currentTime < words[i]!.start) i = 0;
    while (i + 1 < words.length && currentTime >= words[i + 1]!.start) i++;
    // Stick to the most recently uttered word during inter-word gaps —
    // the dot would otherwise blink off briefly between words. Emit the
    // word's `index` (its position in the displayed span sequence), not
    // its array position, so bracketed/skipped words don't desync.
    if (i !== lastWordIdxRef.current) {
      lastWordIdxRef.current = i;
      onWordChange?.(words[i]!.index);
    }
  };

  const ensureAudio = async (): Promise<HTMLAudioElement> => {
    if (audioRef.current) return audioRef.current;
    setState("loading");
    setError(null);
    let res: Response;
    try {
      res = await fetch(SPEAK_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ text, persona }),
      });
    } catch (err) {
      setTtsStatus("unavailable");
      throw err;
    }
    if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) {
      setTtsStatus("unavailable");
      let msg = `${res.status} ${res.statusText}`;
      try {
        const j = await res.json();
        if (j.error) msg = j.error;
      } catch {}
      throw new Error(msg);
    }
    setTtsStatus("available");
    const payload = (await res.json()) as {
      audio: string;
      mime: string;
      words: WordTiming[];
    };
    const bytes = Uint8Array.from(atob(payload.audio), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: payload.mime || "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    wordsRef.current = payload.words ?? [];
    lastWordIdxRef.current = -1;
    const audio = new Audio(url);
    audio.onended = () => {
      setState("idle");
      lastWordIdxRef.current = -1;
      onWordChange?.(-1);
    };
    audio.onpause = () => {
      if (audio.currentTime < audio.duration) setState("paused");
    };
    audio.onplay = () => setState("playing");
    audio.ontimeupdate = () => updateActiveWord(audio.currentTime);
    audio.onerror = () => {
      setState("error");
      setError("audio playback failed");
    };
    audioRef.current = audio;
    setLoaded(true);
    return audio;
  };

  const onClick = async () => {
    try {
      if (state === "playing") {
        audioRef.current?.pause();
        return;
      }
      const audio = await ensureAudio();
      await audio.play();
    } catch (err) {
      setState("error");
      setError((err as Error).message);
    }
  };

  const onRestart = async () => {
    try {
      const audio = await ensureAudio();
      audio.pause();
      audio.currentTime = 0;
      await audio.play();
    } catch (err) {
      setState("error");
      setError((err as Error).message);
    }
  };

  const label =
    state === "loading"
      ? "Loading…"
      : state === "playing"
        ? "Pause"
        : state === "paused"
          ? "Resume"
          : state === "error"
            ? "Retry"
            : "Listen";

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={state === "loading"}
        title={error ?? "Play this reply aloud"}
        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--muted)] px-3 text-xs font-medium text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--background)] hover:text-[color:var(--foreground)] disabled:opacity-60"
      >
        <PlayGlyph state={state} />
        <span>{label}</span>
      </button>
      {loaded && (
        <button
          type="button"
          onClick={onRestart}
          disabled={state === "loading"}
          title="Restart from the beginning"
          aria-label="Restart"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--background)] hover:text-[color:var(--foreground)] disabled:opacity-60"
        >
          <RestartGlyph />
        </button>
      )}
      {error && state === "error" && (
        <span
          className="text-xs text-[color:var(--muted-foreground)]"
          title={error}
        >
          {error.slice(0, 60)}
        </span>
      )}
    </div>
  );
}

function RestartGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 9 8 9" />
    </svg>
  );
}

function PlayGlyph({ state }: { state: PlayState }) {
  if (state === "loading") {
    return (
      <span
        className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden
      />
    );
  }
  if (state === "playing") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <rect x="1.5" y="1" width="2" height="8" fill="currentColor" />
        <rect x="6.5" y="1" width="2" height="8" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <polygon points="2,1 9,5 2,9" fill="currentColor" />
    </svg>
  );
}

type MicState = "idle" | "recording" | "transcribing" | "error";

/**
 * Hold-to-talk dictation button. Click to start, click again to stop —
 * the recorded blob is posted to /transcribe (OpenAI Whisper) and the
 * resulting text is appended to the chat input via the `onTranscript`
 * callback.
 *
 * Hidden silently when the browser doesn't expose getUserMedia /
 * MediaRecorder — there's no useful fallback for dictation.
 */
function MicButton({
  disabled,
  onTranscript,
}: {
  disabled: boolean;
  onTranscript: (text: string) => void;
}) {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  // Silence-detection state. We tap the same MediaStream with a Web
  // Audio analyser, poll RMS at ~20Hz, and stop the recorder once the
  // speaker has gone quiet for SILENCE_MS — or bail after MAX_SILENT_MS
  // with no speech at all (mic permitted but never used).
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const startedAtRef = useRef(0);
  // Tunables. Threshold is RMS on a [-1,1] PCM frame — 0.02 reliably
  // ignores fan/keyboard noise on the dev rigs I tested without
  // missing soft speech. The silence window is generous enough to
  // ride out commas and breath pauses.
  const VAD_THRESHOLD = 0.02;
  const SILENCE_MS = 1500;
  const MAX_SILENT_MS = 8000;

  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const teardownVad = () => {
    if (vadRafRef.current !== null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      teardownVad();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, []);

  if (!supported) return null;

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Pick the first supported mime — Safari historically lags on webm.
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        teardownVad();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        // If silence-detection bailed before any speech was captured,
        // skip the transcription round-trip and just return to idle.
        if (blob.size === 0 || !hasSpokenRef.current) {
          setState("idle");
          return;
        }
        upload(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setState("recording");

      // VAD: feed the live mic stream into an analyser, poll RMS on
      // every animation frame, and auto-stop when the speaker has
      // been quiet long enough.
      try {
        const Ctx: typeof AudioContext =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        hasSpokenRef.current = false;
        startedAtRef.current = performance.now();
        lastSpeechAtRef.current = startedAtRef.current;

        const tick = () => {
          if (!recorderRef.current || recorderRef.current.state !== "recording") {
            return;
          }
          analyser.getFloatTimeDomainData(buf);
          // RMS over the frame — cheap, robust enough for "is anyone
          // talking" decisions. No need for a full VAD model here.
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) {
            const s = buf[i] ?? 0;
            sumSq += s * s;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          const now = performance.now();
          if (rms > VAD_THRESHOLD) {
            hasSpokenRef.current = true;
            lastSpeechAtRef.current = now;
          }
          const silentFor = now - lastSpeechAtRef.current;
          const totalElapsed = now - startedAtRef.current;
          if (hasSpokenRef.current && silentFor > SILENCE_MS) {
            stop();
            return;
          }
          if (!hasSpokenRef.current && totalElapsed > MAX_SILENT_MS) {
            // No speech ever heard — bail without uploading. `onstop`
            // sees `hasSpokenRef === false` and short-circuits.
            stop();
            return;
          }
          vadRafRef.current = requestAnimationFrame(tick);
        };
        vadRafRef.current = requestAnimationFrame(tick);
      } catch {
        // Web Audio failed — fall back to manual stop only. Recording
        // still works, just without auto-stop.
      }
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  };

  const stop = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      setState("transcribing");
      rec.stop();
    }
  };

  const upload = async (blob: Blob) => {
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", blob, `dictation.${ext}`);
      const res = await fetch(TRANSCRIBE_FN_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: form,
      });
      if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try {
          const j = await res.json();
          if (j.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      const j = (await res.json()) as { text?: string };
      const text = (j.text ?? "").trim();
      if (text) onTranscript(text);
      setState("idle");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  };

  const onClick = () => {
    if (state === "recording") return stop();
    if (state === "transcribing") return; // wait
    void start();
  };

  const title =
    state === "recording"
      ? "Stop and transcribe"
      : state === "transcribing"
        ? "Transcribing…"
        : state === "error"
          ? error ?? "error"
          : "Dictate";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "transcribing"}
      title={title}
      aria-label={title}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[color:var(--border)] transition-colors disabled:opacity-50 ${
        state === "recording"
          ? "border-red-500 bg-red-50 text-red-600 animate-pulse"
          : "bg-[color:var(--background)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--muted)]"
      }`}
    >
      {state === "transcribing" ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        <MicGlyph />
      )}
    </button>
  );
}

function MicGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

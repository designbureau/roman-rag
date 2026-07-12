import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import { CHAT_FN_URL, SUPABASE_ANON_KEY } from "~/lib/config";
import { Message, ThinkingIndicator } from "~/components/chat-panel";
import { Button } from "~/components/ui/button";
import type { GalleryFigure } from "~/data/gallery-figures";

// Real RAG chat for the gallery — same useChat → CHAT_FN_URL plumbing as the
// main ChatPanel, and the same Message/ThinkingIndicator bubble rendering
// (markdown, glossary tooltips, word-highlighted TTS playback), just in the
// gallery's own dark layout instead of ChatPanel's grid+citations chrome.
// Used for figures with a `personaKey`; a figure without one (no
// persona_config row or ingested corpus yet) gets the canned AskPanel
// instead — see gallery.tsx.
export function LiveAskPanel({
  figure,
  onSpeakingChange,
}: {
  figure: GalleryFigure;
  onSpeakingChange?: (speaking: boolean) => void;
}) {
  // Only rendered when figure.personaKey is set (see gallery.tsx).
  const persona = figure.personaKey!;
  const configIssue = !CHAT_FN_URL || !SUPABASE_ANON_KEY;
  const threadRef = useRef<HTMLDivElement>(null);

  const { messages, append, isLoading, error, input, handleInputChange, handleSubmit } = useChat({
    api: CHAT_FN_URL,
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: { persona, retrievalFilters: {}, tier: "" },
  });

  useEffect(() => {
    onSpeakingChange?.(isLoading);
  }, [isLoading, onSpeakingChange]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const ask = (q: string) => {
    if (isLoading || configIssue) return;
    append({ role: "user", content: q });
  };

  const last = messages[messages.length - 1];
  const waiting = isLoading && (!last || last.role !== "assistant" || !last.content.trim());

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={threadRef} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto pr-1.5">
        {configIssue && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-xs text-red-200">
            Chat isn't configured (missing Supabase env vars).
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-xs text-red-200">
            {figure.first} couldn't answer that — {error.message || "the request failed"}.
          </div>
        )}

        {messages.map((m) => {
          const streaming = isLoading && m === last;
          if (m.role === "assistant" && streaming && !m.content.trim()) return null;
          return (
            <Message
              key={m.id}
              role={m.role}
              content={m.content}
              persona={persona}
              isStreaming={streaming}
            />
          );
        })}

        {waiting && <ThinkingIndicator />}
      </div>

      <div className="mt-4 flex flex-shrink-0 flex-col gap-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8A7E66]">
          Ask {figure.first}
        </div>
        <div className="flex flex-col gap-2">
          {figure.qa.map((qa) => (
            <Button
              key={qa.q}
              variant="outline"
              onClick={() => ask(qa.q)}
              disabled={isLoading || configIssue}
              className="h-auto justify-start rounded-xl border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-normal text-[#E3DAC6] hover:border-[color:var(--accent)]/50 hover:bg-white/[0.07]"
            >
              {qa.q}
            </Button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="mt-1 flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={`Ask ${figure.first} anything…`}
            disabled={isLoading || configIssue}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[#E3DAC6] placeholder:text-[#5F5849] focus-visible:outline-none focus-visible:border-[color:var(--accent)]/50"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim() || configIssue}
            className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 text-[#14120E] hover:opacity-90"
          >
            {isLoading ? "…" : "Ask"}
          </Button>
        </form>
      </div>
    </div>
  );
}

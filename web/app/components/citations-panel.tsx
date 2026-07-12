import { Badge } from "./ui/badge";

const PERSONA_NAMES: Record<string, string> = {
  classicist: "the Classicist",
  cicero: "Cicero",
  caesar: "Caesar",
  "marcus-aurelius": "Marcus Aurelius",
  augustus: "Augustus",
  seneca: "Seneca",
};

export type RetrievedChunk = {
  chunk_id: string;
  story_id: string;
  story_title: string;
  source: string;
  informant: string | null;
  category: string | null;
  mantis_cycle: boolean;
  chunk_type: string;
  content: string;
  source_url: string;
  latin_text?: string | null;
  cicero_ref?: string | null;
  language?: string | null;
  similarity: number;
};

export type RelatedImage = {
  id: string;
  source: string;
  title: string;
  description: string;
  image_url: string;
  thumb_url: string | null;
  source_url: string;
  similarity: number;
};

export type NotebookPage = {
  thumb_url: string;
  image_url: string;
  page_url: string;
  story_title: string;
  informant: string | null;
  cicero_ref: string | null;
  source_url: string;
};

export function CitationsPanel({
  chunks,
  image,
  notebookPage,
  responseText,
  persona,
}: {
  chunks: RetrievedChunk[];
  image: RelatedImage | null;
  notebookPage: NotebookPage | null;
  responseText: string;
  persona: string;
}) {
  if (!chunks.length) {
    const name = PERSONA_NAMES[persona] ?? "the speaker";
    return (
      <aside className="rounded-md border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
        Sources will appear here when {name} answers.
      </aside>
    );
  }

  // Heuristic match: a chunk is "named" if its story title or informant
  // appears in the assistant's response.
  const named = new Set<string>();
  const lower = responseText.toLowerCase();
  for (const c of chunks) {
    if (
      (c.story_title && lower.includes(c.story_title.toLowerCase())) ||
      (c.informant && lower.includes(c.informant.toLowerCase()))
    ) {
      named.add(c.story_id);
    }
  }

  // Dedupe by story_id — multiple chunks per story get collapsed.
  const seen = new Set<string>();
  const unique = chunks.filter((c) => {
    if (seen.has(c.story_id)) return false;
    seen.add(c.story_id);
    return true;
  });


  return (
    <aside className="space-y-3">
      {image && (
        <article className="overflow-hidden rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/5">
          <a
            href={image.source_url}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <img
              src={image.thumb_url ?? image.image_url}
              alt={image.title}
              className="block w-full bg-[color:var(--muted)] object-contain"
              loading="lazy"
            />
          </a>
          <div className="p-3 text-sm">
            <p className="font-corpus text-sm leading-snug">
              {image.description}
            </p>
            <a
              href={image.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            >
              {image.title} on bal2.cs.uct.ac.za →
            </a>
          </div>
        </article>
      )}

      {notebookPage && (
        // Notebook-page card — matches the artwork card layout
        // (image on top, caption below). Image is a low-res scan
        // thumbnail hot-linked from bal2.cs.uct.ac.za, fetched
        // server-side from the DBLC story metadata page.
        <article className="overflow-hidden rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/5">
          <a
            href={notebookPage.page_url}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <img
              src={notebookPage.image_url}
              alt={`Notebook page — ${notebookPage.story_title}`}
              className="block w-full bg-[color:var(--muted)] object-contain"
              loading="lazy"
            />
          </a>
          <div className="p-3 text-sm">
            <div className="label-mono mb-1 text-[color:var(--accent)]">
              Notebook page
            </div>
            <p className="font-corpus text-sm leading-snug">
              {notebookPage.story_title}
            </p>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
              {notebookPage.cicero_ref}
              {notebookPage.informant && <> · {notebookPage.informant}</>}
            </p>
            <a
              href={notebookPage.page_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            >
              View on bal2.cs.uct.ac.za →
            </a>
          </div>
        </article>
      )}

      <h2 className="text-sm font-medium text-[color:var(--muted-foreground)]">
        Retrieved passages ({unique.length})
      </h2>
      {unique.map((c) => {
        const isNamed = named.has(c.story_id);
        return (
          <article
            key={c.story_id}
            className={`rounded-md border p-3 text-sm transition-colors ${
              isNamed
                ? "border-[color:var(--accent)] bg-[color:var(--accent)]/5"
                : "border-[color:var(--border)]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <a
                href={c.source_url}
                target="_blank"
                rel="noreferrer"
                className="font-corpus text-base hover:underline"
              >
                {c.story_title}
              </a>
              {c.mantis_cycle && <Badge>Mantis</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-[color:var(--muted-foreground)]">
              <span>{c.source}</span>
              {c.informant && <span>· {c.informant}</span>}
              {c.category && <span>· {c.category}</span>}
              <span>· {(c.similarity * 100).toFixed(0)}%</span>
            </div>
            {c.latin_text ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
                  Show Latin
                </summary>
                <p className="mt-1 font-corpus text-sm">{c.latin_text}</p>
              </details>
            ) : c.source === "dblc-stories" ? (
              <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                |xam transcription not yet available —{" "}
                <a
                  href={c.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-[color:var(--foreground)]"
                >
                  view notebook page images
                </a>
              </p>
            ) : null}
          </article>
        );
      })}
    </aside>
  );
}

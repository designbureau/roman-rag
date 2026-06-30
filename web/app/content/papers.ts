// The research papers, rendered as in-site pages under /papers.
//
// Single source of truth: the markdown lives in the repo's top-level
// docs/ and is imported raw at build time, so the papers ship with the
// app without a duplicate copy to keep in sync. (Vite's server.fs.allow
// is widened to the repo root so the dev server can read docs/, which
// sits outside the web/ Vite root.)
//
// NOTE: these are placeholder drafts for the Cicero archive — see plan
// docs/cicero-archive-plan.md (Layer 5).
import archivePaper from "../../../docs/cicero-archive-interface.md?raw";
import ethicsPaper from "../../../docs/voicing-the-dead.md?raw";
import landscapePaper from "../../../docs/rag-for-classics.md?raw";

export type PaperMeta = {
  slug: string;
  /** Short title for nav / cards (the markdown carries the full H1). */
  title: string;
  /** The italic descriptor under each paper's byline. */
  kind: string;
  /** One-line summary for the index cards. */
  blurb: string;
  markdown: string;
};

export const PAPERS: PaperMeta[] = [
  {
    slug: "cicero-archive-interface",
    title: "An Interface to the Cicero Archive",
    kind: "System description",
    blurb:
      "A retrieval-augmented reading interface over Cicero's complete works, " +
      "presented as Latin + English parallel text and grounded strictly in the corpus.",
    markdown: archivePaper,
  },
  {
    slug: "voicing-the-dead",
    title: "Voicing the Dead",
    kind: "On synthetic personae for historical figures",
    blurb:
      "What it means to let Cicero, Caesar, or Tiro speak from a corpus — the " +
      "bounded-knowledge discipline and the refusal to invent speeches or letters.",
    markdown: ethicsPaper,
  },
  {
    slug: "rag-for-classics",
    title: "Retrieval-Augmented Reading for a Classical Corpus",
    kind: "Survey and synthesis",
    blurb:
      "What language technology can and cannot do for a classical corpus: " +
      "parallel-text alignment, lemma-based glossing, and preserving strangeness, with Cicero as the worked example.",
    markdown: landscapePaper,
  },
];

export function getPaper(slug: string): PaperMeta | undefined {
  return PAPERS.find((p) => p.slug === slug);
}

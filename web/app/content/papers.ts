// The research papers, rendered as in-site pages under /papers.
//
// Each paper's markdown body lives as a real .md file in the repo's
// top-level docs/ (imported raw via Vite — see the `fs.allow` entry in
// vite.config.ts, needed since docs/ sits outside the web/ Vite root) and is
// rendered by routes/papers.$slug.tsx via react-markdown. The doc filename
// matches the paper's slug below.
import readingRomeInTranslation from "../../../docs/reading-rome-in-translation.md?raw";
import givingTheDeadAVoice from "../../../docs/giving-the-dead-a-voice.md?raw";
import ragForAClassicalArchive from "../../../docs/rag-for-a-classical-archive.md?raw";

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
    slug: "reading-rome-in-translation",
    title: "Reading Rome in Translation",
    kind: "Essay",
    blurb:
      "The originals beside their public-domain English — Shuckburgh on Cicero, " +
      "Casaubon on Marcus Aurelius, and more: what a translation preserves, and " +
      "what it loses.",
    markdown: readingRomeInTranslation,
  },
  {
    slug: "giving-the-dead-a-voice",
    title: "Giving the Dead a Voice",
    kind: "On synthetic personae for historical figures",
    blurb:
      "The ethics of animating Rome's figures as retrieval-grounded personas — " +
      "bounded knowledge, scoped to each author's own words, and never inventing " +
      "what they did not write.",
    markdown: givingTheDeadAVoice,
  },
  {
    slug: "rag-for-a-classical-archive",
    title: "What RAG Can and Cannot Do for a Classical Archive",
    kind: "Survey and synthesis",
    blurb:
      "Retrieval-augmented reading across a multi-author Roman archive: grounding, " +
      "per-author scoping, citation discipline, and the limits of texts that are " +
      "edited, translated, and partial.",
    markdown: ragForAClassicalArchive,
  },
];

export function getPaper(slug: string): PaperMeta | undefined {
  return PAPERS.find((p) => p.slug === slug);
}

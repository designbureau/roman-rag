// The research papers, rendered as in-site pages under /papers.
//
// Each paper's markdown body lives as a real .md file in the repo's
// top-level docs/ (imported raw via Vite — see the `fs.allow` entry in
// vite.config.ts, needed since docs/ sits outside the web/ Vite root) and is
// rendered by routes/papers.$slug.tsx via react-markdown. The doc filename
// matches the paper's slug below.
import romanArchiveInterface from "../../../docs/roman-archive-interface.md?raw";
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
    slug: "roman-archive-interface",
    title: "An Interface to the Roman Archive",
    kind: "System description",
    blurb:
      "The full account of the system: a multi-author Roman corpus behind " +
      "retrieval-grounded generation, with per-author scoping, a two-stratum " +
      "corpus, bounded first-person personas, the speech pipeline, the " +
      "exedra gallery, and the evaluation design and limitations.",
    markdown: romanArchiveInterface,
  },
  {
    slug: "reading-rome-in-translation",
    title: "Reading Rome in Translation",
    kind: "Essay",
    blurb:
      "The originals beside their public-domain English: Shuckburgh's Cicero, " +
      "Casaubon's Marcus Aurelius, and the rest, with what each translation " +
      "preserves and what it loses.",
    markdown: readingRomeInTranslation,
  },
  {
    slug: "giving-the-dead-a-voice",
    title: "Giving the Dead a Voice",
    kind: "On synthetic personae for historical figures",
    blurb:
      "The ethics of animating Rome's figures as retrieval-grounded personas: " +
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

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
    title: "An interface to the Roman archive",
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
    title: "Reading Rome in translation",
    kind: "Essay",
    blurb:
      "The Roman Archive uses public-domain translations from several " +
      "centuries. Here is what their English preserves, what it changes, " +
      "and why the translator matters to retrieval.",
    markdown: readingRomeInTranslation,
  },
  {
    slug: "giving-the-dead-a-voice",
    title: "Giving the dead a voice",
    kind: "On synthetic personae for historical figures",
    blurb:
      "What it means to let readers address Roman authors in the first " +
      "person, and the constraints needed to keep a reading device from " +
      "turning into historical forgery.",
    markdown: givingTheDeadAVoice,
  },
  {
    slug: "rag-for-a-classical-archive",
    title: "What RAG can and cannot do for a classical archive",
    kind: "Survey and synthesis",
    blurb:
      "Where retrieval helps a reader explore a Roman archive, where it " +
      "falls short, and why author filters and visible citations matter as " +
      "much as the model.",
    markdown: ragForAClassicalArchive,
  },
];

export function getPaper(slug: string): PaperMeta | undefined {
  return PAPERS.find((p) => p.slug === slug);
}

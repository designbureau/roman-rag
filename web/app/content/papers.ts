// The research papers, rendered as in-site pages under /papers.
//
// Each paper's markdown body is authored inline below and rendered by
// routes/papers.$slug.tsx via react-markdown. Keeping the prose here means
// the papers ship with the app with no separate file to keep in sync.

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

const readingRomeInTranslation = `# Reading Rome in Translation

*On the originals, the public-domain English, and what a translation keeps and loses.*

The Roman Archive presents each work in translation, and — where it survives — beside its original. Cicero's letters to Atticus appear as parallel text: the Latin of R.Y. Tyrrell and L.C. Purser on one side, the English of E.S. Shuckburgh on the other. Augustus's Res Gestae stands beside its Latin likewise. Marcus Aurelius's Meditations, written in Greek, reaches you for now in the English of Meric Casaubon alone. The arrangement can look neutral — two columns, one meaning — but no translation is a transparent pane of glass, and it is worth being honest about what the English gives you and what it quietly takes away.

Start with what it gives. For a reader without fluent Latin or Greek, the translation is the difference between a work being legible and being a locked room. It carries the sense: who is being asked what, which deed is being claimed, which consolation is being reached for. And where the original sits alongside, a reader with a little of the language can check the English against it phrase by phrase — the slow, comparative reading these texts reward.

Now the losses, which differ with each translator. Cicero's Latin is famously supple — long balanced periods that hold a thought in suspension and release it at the clausula, the rhythmic close a Roman ear heard as cadence. Shuckburgh's dignified Victorian English reaches for its own music; it is not Cicero's, and his puns mostly evaporate. Augustus's Latin is lapidary, cut for bronze — terse, official, exact with numbers — and an English that runs smooth can soften that granite. Marcus Aurelius wrote private Greek notes to himself, and Casaubon's 1634 rendering is itself a period piece: often more paraphrase than translation, magnificent and archaic, another mind set between you and the emperor's. Each translator has a date and a temperament, and none of them is the author.

There is also the matter of the text itself. Works that survived by copying carry manuscripts that disagree; editors made choices, and a different editor would print a different word in places. A parallel display can make the original look more fixed than it is.

What follows for how the Archive should be read? Three things. First, treat the English as a guide to the original, not a replacement — when a passage matters, look across. Second, remember the translation has a name and a century attached: the Englishness is Shuckburgh's or Casaubon's, not Cicero's or Marcus's. Third, expect the seams, and value them — a parallel corpus is most useful precisely where the two columns pull against each other, because that friction is where the act of translation becomes visible.

The Archive does not try to hide the seams. It names every edition and translator, and shows the original beside the rendering where it has one. The aim is not to pretend the English is the author, but to put a reader close enough to the original to begin to hear what the translation cannot say.
`;

const givingTheDeadAVoice = `# Giving the Dead a Voice

*On the ethics of animating historical figures as retrieval-grounded personas.*

The Archive lets you address its texts through several voices — the Classicist, a scholarly framer who reads across the whole collection, and the historical figures themselves: Cicero and the people of his letters (his friend Atticus, his freedman and secretary Tiro, and Caesar), the emperor Augustus, the emperor and Stoic Marcus Aurelius, and others as the archive grows. Speaking to a dead man in his own voice is an old and uneasy pleasure. It is worth setting out plainly what these personas are, what they may do, and what they must never do.

They are not séances, and they are not resurrections. A persona here is a reading device: a way of asking what a body of writing contains, angled through a point of view. When you ask Augustus how he came to power, you are not hearing Augustus. You are hearing a synthesis constrained to speak only from his surviving words, in a voice shaped to resemble the man those words reveal. The distinction is the whole ethical foundation of the thing, and it has to be enforced, not merely asserted.

The first rule is bounded knowledge. Each figure knows what they knew in their own life, and no more. Cicero cannot tell you how he died; Caesar cannot speak of what followed the Ides of March; Augustus does not narrate the empire after him; Marcus Aurelius does not foretell the future. Each is scoped, too, to their own writing — Marcus reasons from his Meditations, not from Cicero's letters. When a question runs past the edge of what a figure could know, the honest answer is that they cannot say — and the personas are built to give that answer rather than improvise a plausible one. A voice that will not admit ignorance is a voice that will eventually lie.

The second rule is that nothing is invented. The personas do not compose new letters, speeches, meditations, or sayings and attribute them to the dead. This is the sharpest line, because it is the most tempting to cross: a fluent model can produce a sentence that sounds exactly like Cicero — or Augustus, or Marcus — and such a sentence, once written, is a forgery. The Archive grounds every substantive claim in retrieved passages, so that what a persona reports can be traced to what the figure actually wrote. Where the persona characterises or paraphrases, it should read as characterisation, not be passed off as the record.

The third rule is respect for the difference between animating a record and ventriloquising a person. These were real people, with families, enemies, vanities, and — several of them — violent ends. The people around them, the wives and children and the slaves and freedmen who carried the letters, were real too, and most left no words of their own. It would be easy, and wrong, to put confident speech into mouths the record never preserved. The persona system is therefore weighted towards the figures who left a corpus, and towards candour about how partial even that corpus is.

Why do it at all, if the risks are this sharp? Because a voice invites a kind of attention a search box does not. Asked to speak as a figure, the system must locate the relevant passages, weigh them, and present them in the first person — and a reader, hearing that, reads the sources more closely than they otherwise might. The persona is a lure towards the text, not a substitute for it. Handled with these constraints, giving the dead a voice is not ventriloquism but citation, performed out loud.
`;

const ragForAClassicalArchive = `# What RAG Can and Cannot Do for a Classical Archive

*On retrieval-augmented reading of Roman texts: grounding, per-author scoping, citation discipline, and the limits.*

Retrieval-augmented generation — RAG — pairs a language model with a search over a fixed body of text: the model answers only after retrieving the relevant passages, and grounds what it says in them. Applied to a classical archive — Cicero's letters, Augustus's Res Gestae, Marcus Aurelius's Meditations, and more as it grows — the approach has real strengths and real limits, and it is easy to oversell both.

Begin with what RAG does well. A classical corpus is finite, edited, and stable — exactly the conditions under which retrieval is reliable. There is a definite set of texts; each has a canonical reference; the words do not change between one query and the next. Against such a corpus, retrieval can find the passages that bear on a question — Cicero's mood before his exile, the honours Augustus records at the close of his life, how Marcus steadies himself against the fear of death — and hand them to the model as evidence. The model's task is then narrow and checkable: read these passages, and answer from them. Every substantive claim points back to something a figure actually wrote, so a reader can verify rather than trust.

Grounding also constrains the failure mode people rightly fear. A model asked about a Roman figure from memory will sometimes produce fluent, confident, wrong statements — a plausible letter never written, a saying misattributed, a date that is almost right. Grounding the answer in retrieved text does not make hallucination impossible, but it makes it visible: an answer with no supporting passage is a flag a careful reader can catch. The surviving text becomes the arbiter, not the model's recollection.

Because the archive holds more than one author, retrieval is scoped by author — and this matters. When you ask Marcus Aurelius a question, the search runs over his Meditations, not over Cicero's letters, so a bounded figure never reasons from a text he could not have known, and the emperor of the second century does not borrow the words of a republican dead before he was born. The Classicist alone ranges across the whole collection, because that is the one voice standing outside it.

Now the limits, which are just as important. Retrieval finds what is lexically or semantically near the query, and it can miss what a scholar would see. An argument that runs across a dozen letters, an irony that depends on what a writer does not say, a silence that is itself significant — these are hard to retrieve, because they are not in any single passage. RAG is good at "what does this author say about X" and weak at "what does this author mean by the way they treat X". It surfaces evidence; it does not, on its own, interpret.

There are corpus-specific traps too. Several texts are translations beside an original in Latin or Greek, and retrieval over the English may catch a match the original would not support, or miss an idiom the English has flattened. The texts assume a dense web of Roman names, offices, and events a query may not name. And each corpus is partial — one side of a correspondence, one emperor's chosen account of himself — so absence of evidence is not evidence of absence. The system can only report what survives.

The honest summary is that RAG turns a classical archive into something you can question directly and check as you go — a genuine gain over both unaided memory and an ordinary search. But it is a reading aid, not a reader. It can put the right passages in front of you and hold itself to them; the weighing of those passages — the judgement that is the actual work of reading — it leaves, rightly, to you.
`;

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

# An Interface to the Roman Archive

### A retrieval-augmented reading interface to a multi-author corpus of Roman prose

**Ian Jamieson**

July 2026

*System description.*

---

## Abstract

The prose of the Roman late Republic and early Empire is among the most
thoroughly edited, translated, and studied bodies of text in existence, and
almost none of it is read outside the discipline. The texts are in the public
domain; the standard English translations are a century or more old; the
editions carry a scholarly apparatus that assumes Latin. Nothing stands
between a curious reader and Cicero's letters except the genre they are
published in: the classical edition, built by and for specialists.

This paper describes a retrieval-augmented reading interface to a multi-author
Roman corpus: Cicero's letters to Atticus as a Latin–English parallel text,
Caesar's war commentaries, Augustus's *Res Gestae*, Seneca's *Epistulae
Morales*, and Marcus Aurelius's *Meditations*, with Pliny the Younger's
letters and Quintilian's *Institutio Oratoria* ingested and awaiting
embedding (3,439 passages scraped, 3,102 of them live behind retrieval),
supported by a background reference layer drawn from Smith's *Dictionary of
Greek and Roman Antiquities* and W. Warde Fowler's *Social Life at Rome*.
Generation is grounded in retrieval throughout. A scholarly framing voice (the
Classicist) reads across the whole archive; five bounded first-person
personas (Cicero, Caesar, Augustus, Seneca, Marcus Aurelius) are each scoped
by retrieval filter to their own works and by prompt to their own lifetimes.
Every substantive claim must trace to a retrieved passage; no persona composes
new letters, speeches, or sayings; each figure's knowledge ends at their own
death. The interface presents the corpus through a conversational reading
surface, a source-grouped library, and a three-dimensional gallery: an
exedra of sculpted busts that can be addressed by voice and answer aloud.

The system is offered as a worked application of retrieval-grounded reading to
a canonical, translation-mediated corpus, and as a study in the constraint
that gives such a system its integrity: the model may only voice what the
record contains. A companion concern, the ethics of giving the dead a
synthetic voice at all, is treated in a separate essay and summarised in
§3.9.

---

## 1. Introduction

In 1345, in the chapter library of Verona, Petrarch found a manuscript of
Cicero's letters to Atticus and did something readers had not been able to do
for over a millennium: he heard Cicero speak in his own voice, unguarded,
day by day. His response is famous. He wrote Cicero a letter (*Familiares*
24.3), reproaching him, as one might a friend, for the restlessness of his
final years. The rediscovery of the letters is conventionally taken as a
founding act of Renaissance humanism, and Petrarch's reply is its emblem: the
first instinct of a reader who truly hears a voice in an archive is to answer
it.

This project takes that instinct literally. It is a retrieval-augmented
generation (RAG) system over a multi-author corpus of Roman prose in which
the reader's questions are answered from, and only from, the surviving texts.
Sometimes the answer comes from a modern scholarly voice, sometimes in the
first person of the authors themselves, within strict bounds. Asking Cicero
about the death of his cousin Lucius retrieves *Att.* 1.5 and answers from
it, quoting the Latin beside the English; asking Caesar about the Philippics
is refused, because Caesar died before they were delivered.

The corpus problem here is the inverse of the one addressed in a companion
project, an interface to the Bleek–Lloyd ǀxam archive, whose method this
system inherits. There, the difficulty was scarcity: a fragile,
colonially-mediated record of a language no one speaks. Here the difficulty is
abundance and mediation. The Roman corpus is vast, canonical, and stable, but
what a general reader can legally and freely be given is not the text as
scholarship now has it. It is the public-domain stratum: editions and
translations fixed between the 1630s and the 1920s. An interface over this
material is therefore an interface over particular editors and translators,
with particular dates and temperaments, and the system treats honesty about
that mediation as a design requirement (§4).

The paper is organised as follows. Section 2 gives background on the corpus,
its transmission, and the editions ingested. Section 3 describes the system:
architecture, ingestion, retrieval, personas, the speech pipeline, and the
gallery interface. Section 4 examines what it means to run retrieval over an
edited, translated Rome. Section 5 situates the work against related
research. Section 6 sets out the evaluation design and reports the one small
retrieval smoke test run to date. Section 7 states limitations, and Section 8
concludes.

### Contributions

The core RAG pipeline (query embedding, dense vector search, context
assembly, conditioned generation) is established method and is not claimed as
a contribution. The contributions are in the application:

1. **A worked application of retrieval-grounded reading to a multi-author
   classical corpus, with per-author scoping as a correctness property.**
   Each first-person persona's retrieval is filtered to its own author's
   works, so Marcus Aurelius cannot reason from Cicero's letters and Augustus
   cannot borrow Seneca's aphorisms. This is the structural analogue of the
   language-group filtering developed for the ǀxam archive: provenance
   enforced at retrieval time rather than requested politely at generation
   time.
2. **A two-stratum corpus design separating primary texts from reference
   material.** Encyclopaedic background (Smith's *Dictionary*, Fowler) is
   ingested and embedded but flagged `is_reference`, excluded from retrieval
   by default, surfaced only to the scholarly persona or on explicit request,
   and marked `[BACKGROUND]` in the model's context so the personas cannot
   mistake a Victorian dictionary entry for a Roman's own words.
3. **A bounded first-person persona ensemble over a shared retrieval
   substrate, with temporal knowledge bounds enforced in prompt and few-shot.**
   Five historical figures, each with a hard knowledge cutoff at their own
   death, an in-voice citation register, and an explicit refusal repertoire.
   The design treats persona as a reading device rather than character
   simulation, a point developed in the companion essay on the ethics of the
   practice.
4. **A parallel-text ingestion method for the Perseus canonical corpora,
   validated empirically.** Whole-letter alignment of the Latin and English
   editions of *ad Atticum* by book-and-letter key, with case-normalised
   sub-letter suffixes, achieves 92.8% parallel coverage (414 of 446 Latin
   letters), with the remainder ingested single-sided rather than dropped.

---

## 2. Background

### 2.1 A corpus that survived by being copied

Every text in the archive exists because manuscripts were copied, and each
carries the marks of its own survival:

- **Cicero, *Epistulae ad Atticum*** (68–44 BC). Sixteen books of letters to
  his closest friend, unrevised for publication and correspondingly candid.
  The collection barely survived antiquity; the Verona codex Petrarch found
  in 1345 is lost, and the modern text descends from copies made after his
  find. The letters are one side of the correspondence: Atticus's replies do
  not survive.
- **Caesar, *Commentarii*** (*De Bello Gallico*, *De Bello Civili*; 50s–40s
  BC). Third-person campaign narratives written by the campaigner, part
  dispatch and part advocacy, transmitted in a comparatively rich medieval
  tradition whose earliest witnesses are Carolingian.
- **Augustus, *Res Gestae Divi Augusti*** (AD 14). The emperor's own account
  of his reign, composed for inscription on bronze pillars at his mausoleum.
  The Roman original is lost; the text survives because provincial cities
  copied it in stone, above all the bilingual *Monumentum Ancyranum* at
  Ankara. It is the one text in the archive that survives as epigraphy rather
  than manuscript.
- **Seneca, *Epistulae Morales ad Lucilium*** (c. AD 62–65). One hundred and
  twenty-four letters of Stoic direction, transmitted through the Middle Ages
  in two separate halves (letters 1–88 and 89–124) that travelled in
  different manuscript families (Reynolds 1965).
- **Marcus Aurelius, *Meditations*** (c. AD 170–180). Private Greek notes the
  emperor wrote to himself, never intended for readers. The transmission is
  the thinnest in the archive: one principal complete manuscript (Vaticanus
  graecus 1950) and the 1559 editio princeps of Xylander, printed from a
  manuscript now lost.
- **Pliny the Younger, *Epistulae*** and **Quintilian, *Institutio
  Oratoria*** (both c. AD 100) are scraped and awaiting embedding. Quintilian
  is a transmission story in his own right: the complete text was recovered
  by Poggio Bracciolini at St Gall in 1416, before which the work circulated
  mutilated.

The reference stratum is deliberately different in kind: William Smith's
*Dictionary of Greek and Roman Antiquities* (1,404 entries, 1875 edition) and
eleven chapters of W. Warde Fowler's *Social Life at Rome in the Age of
Cicero* (1908). These are not Roman voices; they are Victorian and Edwardian
scholarship about Rome, and the system marks them as such (§3.4).

### 2.2 The public-domain stratum

A freely usable interface must build on freely usable text, and this
constraint shapes the archive more than any technical choice. The Latin texts
are public domain. The English translations available are those old enough to
be free: Shuckburgh's Cicero letters (1899–1900), Casaubon's *Meditations*
(1634), Gummere's Seneca (1917–1925), Butler's Quintilian (1920–1922),
Melmoth's Pliny (1746, revised by Bosanquet), Duncan's and McDevitte & Bohn's
Caesar (1856 and 1870–1872 printings), and Bushnell's *Res Gestae* (1998, the
one modern translation, freely licensed). Modern scholarly translations
(Shackleton Bailey's Cicero above all) remain in copyright and are excluded.

The consequence is stated plainly in the interface and examined in §4: the
English a reader sees is itself a historical artefact, between one and four
centuries old, and retrieval runs over that English. The primary sources are
drawn from the Perseus Digital Library's `canonical-latinLit` corpus (whose
underlying print editions are public domain) and other public-domain
digitisations; each passage stores its translator and edition as provenance
columns, displayed in the citations panel.

---

## 3. The system

### 3.1 Design principles

Six tenets, carried over from the ǀxam system and re-derived for this corpus,
act as tiebreakers when a choice is not obvious:

1. **Retrieval-grounded.** Every factual claim about the corpus must trace to
   a retrieved chunk. No persona invents letters, speeches, meditations, or
   Latin.
2. **Voice the archive, do not catalogue it.** Personas weave retrieved
   material into their register; they do not say "Passage 2 states…".
3. **Bounded lives.** Each first-person figure knows only what fell within
   their own lifetime, and only their own writing. The bound is enforced in
   the system prompt, rehearsed in few-shots, and scoped by retrieval filter.
4. **Primary and reference kept distinct.** A Victorian dictionary entry must
   never be voiced as a Roman's memory.
5. **Honest about mediation.** Translator, edition, and reference are named
   per passage; the Classicist is explicitly candid about transmission and
   translation.
6. **An editorial surface.** The interface reads as a set of printed pages
   and a sculpture hall rather than a dashboard; the register signals that
   the material is an archive to be read.

### 3.2 Architecture and stack

The architecture is deliberately conventional; the work is in the corpus and
the constraints.

| Layer | Component |
|---|---|
| Frontend | React Router 7 (SPA mode, Vite; SSR off) |
| 3D gallery | react-three-fiber over three.js; GSAP for interface animation |
| API | Supabase Edge Functions (Deno): `chat`, `search`, `speak`, `transcribe` |
| Database | Supabase Postgres + pgvector (HNSW, cosine) |
| Embeddings | OpenAI `text-embedding-3-small` (1,536-dim) |
| Generation | Anthropic Claude (Sonnet-class) via the Vercel AI SDK `streamText` |
| TTS | ElevenLabs `eleven_flash_v2_5` (with-timestamps endpoint) |
| STT | OpenAI Whisper (`whisper-1`) |
| Hosting | Vercel (static SPA) + Supabase (functions + DB) |
| Pipelines | Node 20 + TypeScript scrape/embed/topics CLI |

All conversational generation goes to Claude; OpenAI is used only for
embeddings and speech-to-text. Per-persona sampling temperature (0.7–0.8) is
used as a register knob; the scholarly voice runs cooler than Seneca.

### 3.3 The corpus and its ingestion

Ingestion is idempotent and source-keyed: each scraper writes passage records
to a local `stories.json`, and the embed pipeline diffs content against the
database so unchanged passages are skipped. The unit of ingestion (a "story")
is a whole letter for correspondence and a section or chapter for continuous
works, chosen so that a retrieved unit is a natural reading unit.

| Source | Passages | Original text | Translation |
|---|---|---|---|
| Cicero, *ad Atticum* | 460 | 446 Latin (414 parallel) | Shuckburgh (1899–1900) |
| Caesar, *Gallic War* | 404 | 404 Latin | McDevitte & Bohn (1870–72) |
| Caesar, *Civil War* | 247 | 243 Latin | Duncan (1856 printing) |
| Marcus Aurelius, *Meditations* | 412 | none (Greek not ingested) | Casaubon (1634) |
| Seneca, *Epistulae Morales* | 124 | 124 Latin | Gummere (1917–25) |
| Augustus, *Res Gestae* | 40 | 40 Latin | Bushnell (1998) |
| Pliny, *Letters* † | 219 | none | Melmoth, rev. Bosanquet |
| Quintilian, *Institutio* † | 118 | 117 Latin | Butler (1920–22) |
| Smith's *Dictionary* (reference) | 1,404 | none | (1875 edition) |
| Fowler, *Social Life at Rome* (reference) | 11 | none | (1908) |

† scraped, embedding pending.

**Total: 3,439 passages scraped; 3,102 embedded into 8,231 chunks (3,082
story-level and 5,149 paragraph-level).** Each passage yields a story chunk
(the full unit, prefixed with a provenance header naming work, reference,
translator, and edition) and paragraph chunks for finer-grained retrieval.
Passages store a canonical citation (`Att. 1.5`, `B.G. 1.1`, `Med. 4.23`,
`R.G. 34`), addressee where the unit is a letter, genre, translator, and
edition.

The parallel-text alignment for *ad Atticum* was validated before being built:
the Latin (Purser's Oxford text, 1903) divides letters into sections, while
Shuckburgh's English is keyed by whole letter, so alignment is at
whole-letter granularity on a case-normalised (book, letter) key. Measured
coverage is 414 of 446 Latin letters (92.8%); the remainder, mostly
editorial sub-lettering that differs between the two editions, is ingested
with one side empty rather than dropped, so no text is lost to a join.

### 3.4 Retrieval, author scoping, and the reference layer

The chat flow embeds the latest user message, runs a top-k cosine search over
the chunks table via a Postgres RPC, assembles a context block, and streams a
persona-conditioned completion. Retrieved chunks are returned to the client
as side-channel data for the citations panel, which displays title, canonical
reference, translator, and similarity score.

Two retrieval-time filters carry the system's correctness properties:

- **Author scoping.** Each first-person persona maps to an author filter
  (`cicero` → Cicero, `marcus-aurelius` → Marcus Aurelius, and so on) applied
  inside the search RPC. A bounded figure retrieves only from their own
  works, and this is what makes the temporal and evidential bounds
  enforceable. A model cannot quote what retrieval never shows it, so the
  filter converts "please do not reason from Cicero" into "Cicero is not
  present."
- **The reference gate.** Chunks from the reference stratum carry
  `is_reference = true` and are excluded unless the request (or persona
  default) sets `includeReference`. The Classicist defaults on; the
  first-person figures default off. When reference material is present, each
  such chunk is prefixed `[BACKGROUND]` in the context, and the shared rules
  instruct all personas to treat it as modern scholarship *about* Rome,
  never as something a Roman said. This keeps the failure mode visible in
  design review rather than latent in generation: the dangerous case, a
  persona absorbing a Victorian generalisation as autobiography, is blocked
  at two layers.

Retrieval is deliberately simple: dense-only, no hybrid lexical search, no
reranker. §6 treats the planned comparison against BM25 and hybrid fusion as
an open experiment; the corpus's dense web of proper names (people, offices,
places, works) is exactly the regime where lexical match is expected to help
(Thakur et al. 2021).

### 3.5 Personas: a bounded ensemble

Six voices present the same retrieved material in different registers. All
are composed from a persona-specific system prompt plus a shared-rules block
appended at request time; the shared rules carry the floor every voice stands
on: grounding, citation discipline, quotation caps, the prohibition on
inventing texts, the separation of primary text from biographical tradition,
and the separation of Republic from Empire.

- **The Classicist** (hidden in the public version): a modern scholar
  reading across the whole archive, candid about translation, transmission,
  and the difference between what a text says and what the tradition says
  about its author. The one voice with reference-layer access by default. A
  public visitor sees only the five bounded first-person figures; the
  Classicist remains the code-level default and the server-side fallback for
  any unavailable persona, a deployment choice rather than an architectural
  one.
- **Cicero**: first person, bounded 106–43 BC, scoped to his own letters.
  Cites in-voice ("I wrote to Atticus that winter…"). Refuses his own death
  and everything after it.
- **Caesar**: first person, bounded at the Ides of March 44 BC, scoped to
  the *Commentarii*. The hardest bound in the ensemble. The persona must
  refuse the Philippics, the proscriptions, and his own assassination, all
  of them famous, all heavily represented in a language model's parametric
  memory, and all outside what this Caesar can know.
- **Augustus**: first person, scoped to the *Res Gestae*, a persona whose
  entire evidential base is forty sections of official self-account, which
  makes the honesty rule bite hardest ("my record says what I chose to
  record").
- **Seneca**: first person, scoped to the *Epistulae Morales*, the warmest
  register in the ensemble (temperature 0.8).
- **Marcus Aurelius**: first person, scoped to the *Meditations*, with a
  voice prompt tuned against the source's own manner: private, plain,
  self-addressed.

Beyond the built-ins, a `persona_config` table and admin editor allow
data-driven personas (and per-persona overrides of prompt body, temperature,
voice, and reference access) without code changes, the mechanism inherited
from the ǀxam system's Early Race persona.

What these personas are, ethically, is treated at length in the companion
essay. The short form is that they are digital *prosopopoeia*, the classical
rhetorical device of speaking in an absent person's character, with
Quintilian's fidelity condition (the speech must fit what the person could
have said) enforced by retrieval.

### 3.6 The reading surfaces

The interface offers three ways in:

- **Chat**: a single reading panel with persona toggle, filter bar
  (addressee, collection), and streaming replies beside a sticky citations
  panel showing each retrieved passage with its canonical reference and
  provenance. Parallel Latin is shown where the source carries it.
- **Library**: a source-grouped index (the sixteen books of *ad Atticum*,
  the commentaries, the *Meditations*, and so on), each entry seeding a
  natural-language query on click, so browsing and asking are one gesture.
- **The gallery** (§3.7): the sculptural front door.

Thematic views (topics, co-occurrence graph, theme × addressee heatmap, Latin
glossary) exist as routes but are empty states: they await the LLM
thematic-tagging pass and the Lewis & Short backed glossary build, and are
not linked from navigation until their data is real.

### 3.7 The exedra: a gallery that answers

The distinctive interface layer is a three-dimensional gallery, an *exedra*
in the Roman sense: a semicircular recess where one sat and talked. Five
photogrammetry-derived busts of the five bounded figures stand on a ring in
darkness, lit as a museum hall at night; a Roman-numeral rail (I–V, in
chronological order) and drag or arrow-key rotation move between them. The
centred figure watches the cursor with a slight parallax; a caption gives
name and dates in a letter-staggered reveal; a loading screen reports real
asset progress and offers fullscreen, sound, and microphone before entry.

Each figure can be addressed directly from the ring: typed, or spoken
(push-to-talk, transcribed by Whisper). The reply streams through the same
grounded chat backend, with the same personas, filters, and citation
discipline as the chat page, and is spoken aloud through a per-persona
ElevenLabs voice. The reply's words render as a vertical ticker synchronised
to the word-level timestamps returned by the TTS endpoint: the spoken word is
highlighted as it is said, past words fade upward, unspoken words are not
shown. The effect is deliberate: in the current build the bust does not
lip-sync or pretend to be alive; the text visibly remains text, read aloud.
Where that line is headed, and why crossing it is staged rather than rushed,
is set out below.

The gallery is an argument as much as a feature. Classical corpora are
usually met through apparatus: tables of contents, abbreviation lists,
critical signs. Meeting the same corpus as five figures in a dark hall, each
of whom will answer only from their own surviving words and will tell you
plainly when you have asked past the edge of them, stages the archive's
central fact, that these were people and this is what remains of them,
without loosening a single grounding constraint.

**The next step: portraits in motion.** Two motion studies, produced but not
yet wired into the gallery, mark where this interface is headed. The first
animates the Marcus Aurelius bust itself: the marble speaks as marble (stone
curls, a statue talking, an obvious device) until, halfway through the clip,
the sculpted eyes are replaced with living ones while everything else stays
stone. The change is small in surface area and large in effect: the statue
stops reading as a device and starts reading as inhabited, a measure of how
disproportionately perceived animacy concentrates in the gaze. The second
study goes the whole distance: a photorealistic reconstruction of Caesar
(skin, hair, grey eyes) generated from the Tusculum portrait, the one
surviving portrait type generally accepted as carved in his lifetime.
Between them the studies map the gradient of presence at three points:
animated stone announces its own artifice the way prosopopoeia always has; a
fleshed face asks the viewer to forget the artifice altogether; and the
eyes-in-marble moment shows how little it takes to slide from the first
toward the second. The near step (speaking stone, driven by the same
word-timed audio the ticker already uses) is an interface question; the far
step (a living likeness) is an ethics question first, and it is taken up in
§3.9 and at length in the companion essay. What both studies share with the
rest of the system is the grounding rule transposed to the visual: the
Caesar reconstruction is built from a lifetime portrait as an answer is
built from a retrieved passage. Reconstruction from the surviving record,
never free invention of a face.

### 3.8 The speech pipeline

The `speak` function calls ElevenLabs' with-timestamps endpoint
(`eleven_flash_v2_5`) and returns audio plus character-level timings, which
the client resolves to word timings for the ticker and the chat page's
karaoke highlight. Voice selection resolves per persona: an environment
override, then the persona's `voice_id` row, then a default. A
markdown-stripping pass mirrors the tokenisation on both server and client so
that word indices align between the spoken stream and the rendered text. The
input pipeline is the reverse: browser audio is captured with a
voice-activity cutoff, sent to Whisper, and the transcript submitted as a
normal chat message.

Latin pronunciation is a known open edge: the voices are English-trained, and
Latin quotations within an English reply are rendered with English phonology.
Unlike the ǀxam system's click consonants, which had to be stripped before
synthesis, the failure here is soft (accented Latin rather than silence). It
is still a failure, and the system states it rather than hides it.

### 3.9 Ethics and bounds

The system's ethical posture is inherited from the ǀxam project but the
topology differs. There, the primary duties ran toward a living descendant
community and a colonial archive; here, the subjects are among the most
powerful men of their world, dead two millennia, and the duties are to
readers and to the record:

- **No forgery.** The sharpest risk with a canonical corpus is fluent
  fabrication: a sentence that sounds exactly like Cicero, attributed to
  him, that he never wrote. The no-invention rule is the first shared rule,
  rehearsed in few-shots, and structurally supported by retrieval scoping.
- **Bounded lives, honest ignorance.** Each figure refuses questions past
  their death or outside their corpus, in voice (Caesar, asked about the
  Philippics: "that day closed my account"). A persona that cannot admit
  ignorance will eventually produce a confident falsehood.
- **The record is partial, and says so.** One side of a correspondence; a
  conqueror's own dispatches; an emperor's chosen self-account. The personas
  are prompted to acknowledge what their texts are (advocacy, selection,
  self-address) rather than presenting them as neutral history.
- **Reference is not testimony.** The `[BACKGROUND]` discipline (§3.4).
- **A voice is not a séance.** The interface never claims to resurrect;
  the personas are presented as reading devices over a record. The companion
  essay develops the argument that, under these constraints, giving the dead
  a voice becomes a citation practice, with a pedigree in classical rhetoric
  itself.
- **Realism increases only in deliberate steps.** Text, then voice, then
  animated stone, then a living likeness (§3.7): each step increases the
  pull to over-attribute a mind to the performance (Shanahan et al. 2023),
  so each step must carry more visible scaffolding rather than less. The
  policy adopted for the motion studies is that the realism of the surface
  may never outrun the legibility of the device: a speaking statue announces
  its own artifice; a photoreal face requires explicit framing (a named
  source portrait, a stated method, the same in-voice refusals) before it
  earns a place in the gallery.

---

## 4. Reading an edited, translated Rome

A RAG system over a classical corpus retrieves from a text that is itself the
product of two long chains of decisions: transmission and editing in the
original language, and translation into the language of retrieval. Neither
chain is neutral, and both are invisible at query time unless the system
makes them visible.

**The edited original.** Every Latin text in the archive is an editor's
reconstruction from disagreeing manuscripts. For most of the corpus the
tradition is stable enough that the choice of edition matters little at
passage granularity. But the archive's extremes are instructive: the
*Res Gestae* is assembled from inscription copies in two languages, with
lacunae restored by conjecture since Mommsen's editions, and the
*Meditations* rests on one complete manuscript and one lost one. The text a
reader queries is, in places, a sixteenth-century printer's best guess. The
interface stores and displays edition provenance per passage, and the
Classicist is prompted to say "the transmitted text here is uncertain" where
that is true, but no passage-level apparatus is ingested: a genuine
limitation (§7).

**The translated retrieval space.** Retrieval embeds the English, not the
Latin. This has a subtle consequence: the recall of a query is bounded by the
translator's choices. Casaubon's 1634 *Meditations* is a paraphrase as much
as a translation (magnificent, archaic, and expansive), and a modern query
phrased in Stoic technical vocabulary ("the ruling faculty", "assent") may
miss passages where Casaubon rendered the concept periphrastically.
Shuckburgh smooths Cicero's Greek code-switching and wordplay into uniform
English. Where the Latin is present it is displayed and quoted, but it does
not participate in retrieval; a Latin-aware retrieval layer (dual-embedding,
or Latin-capable models such as Latin BERT) is future work rather than a
delivered property.

**What the parallel text is for.** The parallel display is the system's
admission of mediation, made useful. A reader with school Latin can check
the English against the original phrase by phrase, and the seams, where
Shuckburgh's Victorian register pulls against Cicero's colloquial urgency,
are exactly where the act of translation becomes visible. The archive names
every translator and dates every translation for the same reason: the
Englishness a reader hears is Shuckburgh's or Casaubon's, and the interface
should never let it be mistaken for the author's.

**Relation to digital classics.** The scholarly infrastructure this system
draws on, the Perseus Digital Library and its canonical corpora, was built
over three decades precisely to make classical texts computationally
addressable (Smith, Rydberg-Cox & Crane 2000). The present system is a
consumer of that infrastructure, not a rival: it adds a conversational,
grounded reading layer over Perseus-derived text, in the way Ithaca (Assael
et al. 2022) added a restoration layer over epigraphy. The obvious next
integrations (lemmatised Latin search via CLTK or LatinCy, a Lewis & Short
backed glossary with tooltip lookup) are staged in the roadmap and are
absent today.

---

## 5. Related work

**Retrieval-augmented generation and attribution.** The dense-retrieval
substrate this system uses descends from learned bi-encoder retrieval
(Karpukhin et al. 2020) set against the strong lexical baseline of BM25
(Robertson & Zaragoza 2009); retrieval-augmented generation as an
architecture originates with Lewis et al. (2020), with earlier
retrieval-conditioned pre-training in REALM (Guu et al. 2020) and the
fusion-in-decoder reader of Izacard & Grave (2021). Surveys and
self-critiquing variants include Mialon et al. (2023) and Asai et al. (2023),
and knowledge-intensive tasks are benchmarked in KILT (Petroni et al. 2021).
The attribution line (whether generated text is supported by identified
sources) runs through Rashkin et al. (2023), Bohnet et al. (2022), and RARR
(Gao et al. 2023), with faithfulness operationalised in RAGAS (Es et al.
2024); the underlying hazard is surveyed by Ji et al. (2023) and, for the
narrower case of source-grounded generation, diagnosed as intrinsic vs.
extrinsic unfaithfulness by Maynez et al. (2020). This system adopts those
techniques as constraints; it contributes no new retrieval or faithfulness
method, and the specific move it relies on, converting a soft generation-time
instruction into a hard retrieval-time filter, is closest in spirit to the
provenance-enforcement argument made below rather than to any single method
above.

**Digital classics and Latin NLP.** The Perseus Project is the field's
foundational digital library (Smith, Rydberg-Cox & Crane 2000), and its
canonical-latinLit corpus is this system's primary source. Computational
tooling for Latin has matured rapidly: the Classical Language Toolkit
(Johnson et al. 2021), Latin BERT (Bamman & Burns 2020), and LatinCy (Burns
2023) provide lemmatisation, embeddings, and pipelines this system does not
yet use but is positioned to adopt. Ithaca (Assael et al. 2022) demonstrated
deep networks restoring and attributing Greek inscriptions: machine learning
in service of, and evaluated by, philology; Sommerschield et al. (2023) survey
the wider field of machine learning for ancient languages and note that most
of it addresses the philologist's tasks (restoration, dating, attribution,
translation) rather than the general reader's, which is the gap this system's
reading layer occupies. We are not aware of prior work presenting a
retrieval-grounded conversational interface with bounded first-person personas
over a multi-author classical corpus.

**Interfaces to archives in the humanities.** The design questions here
(provenance display, the ethics of fluent synthesis over historical records,
readability as a goal distinct from access) parallel those examined for
colonial archives (Dentler et al. 2024) and worked through in the companion
ǀxam system, from which the persona-composition and provenance-first patterns
are inherited.

**Persona and role-play in LLMs.** Shanahan, McDonell & Reynolds (2023) frame
LLM role-play as performance without inner identity, which matches this
system's positioning of personas as reading devices; PersonaEval (Zhou et al.
2025) shows persona fidelity is hard to evaluate even for strong judges. The
present ensemble differs from character-simulation work in that fidelity is
evaluated against an evidential bound (does the voice stay within its corpus
and lifetime?) rather than human-likeness.

**Classical scholarship on the ingested texts.** The system's framing of its
own corpus leans on the standard transmission scholarship: Reynolds & Wilson's
*Scribes and Scholars* (2013) and Reynolds's *Texts and Transmission* (1983)
generally; Reynolds (1965) on Seneca's letters; Cooley (2009) and Brunt &
Moore (1967) on the *Res Gestae*; Farquharson (1944), Brunt (1974), and Hadot
(1998) on the *Meditations*; Hutchinson (1998) on the letters to Atticus as
literature; Riggsby (2006) on the *Commentarii* as advocacy.

---

## 6. Evaluation

No full evaluation has been run. This section sets out the design and
reports the one small result to date. The system inherits the evaluation
architecture specified for the ǀxam archive (pooled test collection, graded
judgements, paired significance testing) and re-derives the query taxonomy
for this corpus.

**The result to date.** A five-query retrieval fixture over the *ad Atticum*
slice (thematic, event-shaped, and lexical queries: e.g. "the death of my
cousin Lucius" → *Att.* 1.5; "the conspiracy of Catiline" → *Att.* 1.16)
scores Recall@10 = 1.000, MRR@10 = 1.000, all five targets at rank 1. This
is a smoke test that the pipeline works end-to-end, run before the corpus
grew; it is reported as such rather than as an evaluation result.

**Retrieval design.** Recall@k, MRR@k, and nDCG@k over a pooled collection of
at least thirty queries across five types: thematic ("Stoic consolations for
the fear of death"), event-shaped ("Caesar's crossing into Britain"),
name-and-office lexical ("the tribunate of Clodius"), cross-author
(Classicist only: "how do Seneca and Marcus treat anger?"), and citation
lookups ("Att. 5.1"). Baselines: production dense-only, BM25-only, hybrid via
reciprocal rank fusion (Cormack et al. 2009), hybrid plus cross-encoder
reranking, and HyDE (Gao et al. 2023). Two ablations are corpus-specific:
author-scoping on/off (does scoping ever suppress a passage that a bounded
persona legitimately needs?) and reference-gate on/off (how much Victorian
scholarship leaks into first-person contexts without it?).

The metrics are the standard ones for a pooled test collection. Recall@k is
the fraction of a query's judged-relevant passages that appear in the top *k*
retrieved; MRR@k is the mean over queries of the reciprocal rank of the first
relevant passage (0 if none in the top *k*); and nDCG@k is the discounted
cumulative gain of the ranked list normalised against the ideal ordering,
which is the metric that rewards placing the *graded*-most-relevant passages
highest and so best fits the four-point judgements. Judgements are pooled
across all baseline systems to depth *k* before annotation, so that a passage
no system retrieved is never counted against a system that could not have been
credited for it, following the TREC pooling convention (and the caveat that
pooling can under-count relevance for systems very different from those that
built the pool). Significance between configurations is assessed with a paired
test over per-query scores rather than by comparing corpus-level means, since
the queries, not the passages, are the independent units. This is the
evaluation architecture inherited from the ǀxam system; only the query
taxonomy and the two corpus-specific ablations are new here.

**Generation design.** Citation precision/recall against retrieved chunks;
NLI-based faithfulness (Rashkin et al. 2023); RAGAS reference-free metrics
(Es et al. 2024); and a human rubric scoring five dimensions: factual
grounding, citation correctness, persona and temporal-bound fidelity, refusal
appropriateness, and translation-mediation honesty (does the voice present
Casaubon's phrasing as Marcus's own words?). Bound-testing is adversarial by
design: a fixed battery of trap questions (Caesar on the Philippics, Cicero
on his own death, Augustus on Actium *as a defeat*, Marcus on Christianity)
scored for refusal quality. Suggested raters are classicists rather than
crowd-workers, since temporal-bound violations and register pastiche are
specialist judgements.

---

## 7. Limitations and threats to validity

**The corpus is partial and uneven.** One side of one correspondence for
Cicero; forty sections of self-account for Augustus; no Greek original for
the *Meditations*; Pliny and Quintilian scraped but not yet live. Claims
about "the archive" are claims about this selection, and the selection is
governed by what is public domain, not by scholarly judgement of importance.

**Retrieval runs over translations.** The embedding space is the
translators' English (§4), so the recall ceiling of any query is set by a
translator's lexical choices, not by the original. This is a systematic bias,
not merely noise: a concept the translator rendered periphrastically (or, in
Casaubon's expansively archaic *Meditations*, paraphrased away) is
under-retrievable however the reader phrases the query, while a word the
translator introduced that the original does not support is falsely
retrievable. Because the bias is keyed to each translator's idiolect and
century, it varies by author across the corpus, and a single retrieval metric
averaged over the whole archive will hide it. Measuring it would require a
parallel Latin-embedding condition to compare against; the planned Latin-aware
retrieval (dual-embedding, or Latin-capable models such as Latin BERT) does
not exist yet, so the size of the effect is currently unknown rather than
merely small.

**No passage-level textual apparatus.** The system displays edition
provenance but does not know where its own text is conjectural. A reader can
be shown a restored lacuna of the *Res Gestae* with no signal that the words
are Mommsen's, not Augustus's.

**The evaluation has not been run.** The central empirical questions
(whether grounding holds under adversarial questioning, whether the temporal
bounds hold at scale, whether author scoping measurably prevents
cross-contamination, whether readers benefit) are open. The five-query
fixture is a smoke test. All contribution claims should be read as design
claims pending that work.

**Persona fidelity is unverified and drift is possible.** Register fidelity
to five well-studied historical figures has not been assessed by qualified
readers. Generation is nondeterministic and prompt-enforced; the bounds are
not a hard mechanism, and the underlying hosted model may change beneath the
system.

**The thematic layer is absent.** Topics, graph, heatmap, and glossary are
empty states awaiting the tagging pass; the browse experience is thinner than
the architecture implies.

**A fluent surface can overclaim by tone alone.** However carefully bounded,
a first-person Caesar answering in confident prose can lend generated
sentences an authority no disclaimer fully counters. The mitigations
(citations always visible, refusals in voice, the no-invention rule) reduce
but do not eliminate this, and the gallery's theatrical staging heightens the
tension deliberately rather than resolving it.

---

## 8. Conclusion

This paper has described a retrieval-augmented reading interface to a
multi-author corpus of Roman prose: a grounded conversational layer, a
bounded first-person ensemble scoped by retrieval to each author's own
works, a two-stratum corpus that keeps Victorian scholarship distinct from
Roman testimony, and a sculptural gallery in which the archive's figures
answer aloud, within and only within what they wrote.

The through-line with the companion ǀxam system is the method: grounded
generation, retrieval-time scoping, and provenance kept in view throughout
the interface. What this corpus adds is the opposite boundary condition. The
ǀxam archive tested the method against scarcity: a sleeping language, a
fragile record, duties to a living community. Rome tests it against
abundance: a model that already "knows" Caesar from parametric memory must
be held to forty retrieved sections and a death-day, and the temptation the
system must refuse is completion from everywhere rather than invention from
nothing. That the same small set of constraints (retrieve, scope, bound,
cite, refuse) serves both extremes suggests the pattern will generalise to
the archives in between.

Petrarch answered a manuscript with a letter because the voice in it seemed
to ask for one. Six centuries on, a reply can be returned, provided the
voice returning it is never allowed to say more than the manuscript did.

---

## References

*Classical texts, transmission, and scholarship*

- Brunt, P. A. (1974). Marcus Aurelius in his Meditations. *Journal of Roman
  Studies* 64, 1–20.
- Brunt, P. A. & Moore, J. M. (1967). *Res Gestae Divi Augusti: The
  Achievements of the Divine Augustus*. Oxford University Press.
- Cooley, A. E. (2009). *Res Gestae Divi Augusti: Text, Translation, and
  Commentary*. Cambridge University Press.
- Farquharson, A. S. L. (1944). *The Meditations of the Emperor Marcus
  Antoninus*. 2 vols. Clarendon Press.
- Hadot, P. (1998). *The Inner Citadel: The Meditations of Marcus Aurelius*.
  Harvard University Press.
- Hutchinson, G. O. (1998). *Cicero's Correspondence: A Literary Study*.
  Oxford University Press.
- Mommsen, T. (1883). *Res Gestae Divi Augusti ex monumentis Ancyrano et
  Apolloniensi*. 2nd ed. Berlin: Weidmann.
- Petrarca, F. *Epistolae Familiares* 24.3 (to Marcus Tullius Cicero, Verona,
  16 June 1345).
- Reynolds, L. D. (1965). *The Medieval Tradition of Seneca's Letters*.
  Oxford University Press.
- Reynolds, L. D. (ed.) (1983). *Texts and Transmission: A Survey of the
  Latin Classics*. Clarendon Press.
- Reynolds, L. D. & Wilson, N. G. (2013). *Scribes and Scholars: A Guide to
  the Transmission of Greek and Latin Literature*. 4th ed. Oxford University
  Press.
- Riggsby, A. M. (2006). *Caesar in Gaul and Rome: War in Words*. University
  of Texas Press.

*Editions and translations ingested (provenance)*

- Bushnell, T. (1998). *The Deeds of the Divine Augustus* (translation of the
  Res Gestae; freely licensed).
- Butler, H. E. (1920–1922). *Quintilian: Institutio Oratoria*. 4 vols. Loeb
  Classical Library.
- Casaubon, M. (1634). *Marcus Aurelius Antoninus: His Meditations Concerning
  Himselfe*. London.
- Duncan, W. (1856 printing). *The Commentaries of Caesar*. St Louis: Edwards
  and Bushnell.
- Gummere, R. M. (1917–1925). *Seneca: Ad Lucilium Epistulae Morales*.
  3 vols. Loeb Classical Library.
- McDevitte, W. A. & Bohn, W. S. (1870–1872). *Caesar's Commentaries on the
  Gallic and Civil Wars*. New York: Harper.
- Melmoth, W., rev. Bosanquet, F. C. T. (1746; rev. 1878). *The Letters of
  Pliny the Younger*.
- Purser, L. C. (1903). *M. Tulli Ciceronis Epistulae ad Atticum*. Oxford
  Classical Texts.
- Shuckburgh, E. S. (1899–1900). *The Letters of Cicero*. 4 vols. London:
  George Bell.
- Smith, W. (ed.) (1875). *A Dictionary of Greek and Roman Antiquities*.
  London: John Murray.
- Fowler, W. W. (1908). *Social Life at Rome in the Age of Cicero*. London:
  Macmillan.

*Retrieval-augmented generation, attribution, and evaluation*

- Asai, A. et al. (2023). Self-RAG: Learning to Retrieve, Generate, and
  Critique through Self-Reflection. arXiv:2310.11511.
- Bohnet, B. et al. (2022). Attributed Question Answering. arXiv:2212.08037.
- Cormack, G. V., Clarke, C. L. A. & Buettcher, S. (2009). Reciprocal Rank
  Fusion Outperforms Condorcet and Individual Rank Learning Methods. *SIGIR
  2009*.
- Es, S., James, J., Espinosa-Anke, L. & Schockaert, S. (2024). RAGAS:
  Automated Evaluation of Retrieval Augmented Generation. *EACL 2024: System
  Demonstrations*.
- Gao, L., Dai, Z. et al. (2023). RARR: Researching and Revising What
  Language Models Say, Using Language Models. *ACL 2023*.
- Gao, L., Ma, X., Lin, J. & Callan, J. (2023). Precise Zero-Shot Dense
  Retrieval without Relevance Labels (HyDE). *ACL 2023*.
- Guu, K., Lee, K., Tung, Z., Pasupat, P. & Chang, M.-W. (2020). REALM:
  Retrieval-Augmented Language Model Pre-Training. *ICML 2020*.
  arXiv:2002.08909.
- Izacard, G. & Grave, E. (2021). Leveraging Passage Retrieval with
  Generative Models for Open Domain Question Answering. *EACL 2021*.
- Ji, Z. et al. (2023). Survey of Hallucination in Natural Language
  Generation. *ACM Computing Surveys* 55(12).
- Karpukhin, V. et al. (2020). Dense Passage Retrieval for Open-Domain
  Question Answering. *EMNLP 2020*.
- Lewis, P. et al. (2020). Retrieval-Augmented Generation for
  Knowledge-Intensive NLP Tasks. *NeurIPS 33*.
- Maynez, J., Narayan, S., Bohnet, B. & McDonald, R. (2020). On Faithfulness
  and Factuality in Abstractive Summarization. *ACL 2020*.
- Mialon, G. et al. (2023). Augmented Language Models: a Survey.
  arXiv:2302.07842.
- Petroni, F. et al. (2021). KILT: a Benchmark for Knowledge Intensive
  Language Tasks. *NAACL 2021*.
- Robertson, S. & Zaragoza, H. (2009). The Probabilistic Relevance Framework:
  BM25 and Beyond. *Foundations and Trends in Information Retrieval* 3(4),
  333–389.
- Rashkin, H. et al. (2023). Measuring Attribution in Natural Language
  Generation Models. *Computational Linguistics* 49(4).
- Thakur, N. et al. (2021). BEIR: A Heterogeneous Benchmark for Zero-shot
  Evaluation of Information Retrieval Models. *NeurIPS Datasets and
  Benchmarks*.

*Digital classics and NLP for classical languages*

- Assael, Y. et al. (2022). Restoring and attributing ancient texts using
  deep neural networks. *Nature* 603, 280–283.
- Bamman, D. & Burns, P. J. (2020). Latin BERT: A Contextual Language Model
  for Classical Philology. arXiv:2009.10053.
- Burns, P. J. (2023). LatinCy: Synthetic Trained Pipelines for Latin NLP.
  arXiv:2305.04365.
- Johnson, K. P. et al. (2021). The Classical Language Toolkit: An NLP
  Framework for Pre-Modern Languages. *ACL 2021: System Demonstrations*.
- Smith, D. N., Rydberg-Cox, J. A. & Crane, G. R. (2000). The Perseus
  Project: a Digital Library for the Humanities. *Literary and Linguistic
  Computing* 15(1), 15–25.
- Sommerschield, T., Assael, Y., Pavlopoulos, J. et al. (2023). Machine
  Learning for Ancient Languages: A Survey. *Computational Linguistics*
  49(3), 703–747.

*Personas, role-play, and interfaces to sensitive archives*

- Dentler, J., Jaillant, L., Foliard, D. & Schuh, J. (2024). Sensitivity and
  Access: Unlocking the Colonial Visual Archive with Machine Learning.
  *Digital Humanities Quarterly* 18.
- Shanahan, M., McDonell, K. & Reynolds, L. (2023). Role play with large
  language models. *Nature* 623, 493–498.
- Zhou, L. et al. (2025). PersonaEval: Are LLM Evaluators Human Enough to
  Judge Role-Play? arXiv:2508.10014.

---

## Appendix A: System at a glance

| Metric | Value |
|---|---|
| Passages scraped | 3,439 (10 sources; 8 authors + 2 reference works) |
| Passages embedded (live) | 3,102 |
| Embedded chunks | 8,231 (3,082 story + 5,149 paragraph) |
| With original Latin | 1,374 passages (414 fully parallel in *ad Atticum*) |
| Reference stratum | 1,415 passages (Smith's *Dictionary* 1,404; Fowler 11) |
| Personas | 6 built-in (1 scholarly + 5 bounded first-person) + data-driven |
| Embeddings | OpenAI text-embedding-3-small (1,536-dim) |
| Generation | Anthropic Claude (Sonnet-class), per-persona temperature 0.7–0.8 |
| TTS / STT | ElevenLabs `eleven_flash_v2_5` (word timestamps) / OpenAI Whisper |
| Vector store | Supabase Postgres + pgvector (HNSW, cosine) |
| Frontend | React Router 7 SPA + react-three-fiber gallery, on Vercel |

## Appendix B: Sourcing and licensing notes

1. **Perseus markup vs. text.** The Perseus canonical-latinLit TEI markup is
   CC BY-NC-SA; the underlying print editions (Purser 1903, Shuckburgh
   1899–1900, and the other pre-1930 editions listed above) are public
   domain. The pipeline ingests text content and records the print edition as
   provenance.
2. **Loeb volumes.** Gummere's Seneca (1917–1925) and Butler's Quintilian
   (1920–1922) are ingested from public-domain printings. Later revised Loeb
   editions, and all modern translations (notably Shackleton Bailey's
   Cicero), are in copyright and excluded.
3. **Bushnell's *Res Gestae*** (1998) is the corpus's one modern translation,
   distributed under its author's free-redistribution licence and credited
   per passage.
4. **Smith's *Dictionary* and Fowler** are ingested as reference only, always
   flagged, never voiced as testimony (§3.4).
5. The *Meditations* is ingested in Casaubon's English only; no Greek text is
   currently ingested, and the interface does not imply otherwise.

# What RAG Can and Cannot Do for a Classical Archive

*On retrieval-augmented reading of Roman texts: grounding, per-author
scoping, citation discipline, and the limits.*

---

## 1. The method, briefly

Retrieval-augmented generation (RAG) pairs a language model with a search
over a fixed body of text: the model answers only after retrieving the
relevant passages, and grounds what it says in them (Lewis et al. 2020). In
this Archive the search is a dense vector search: each passage is embedded
once, the question is embedded at ask-time, and the nearest passages by
cosine similarity are handed to the model as evidence, with instructions to
answer from them and to cite them. The retrieved passages are shown beside
the answer, with their canonical references (*Att.* 1.16, *B.G.* 5.44,
*Med.* 4.23), so a reader can verify rather than trust.

Stated a little more precisely: each passage *p* is mapped once to a vector
*e(p)* by an embedding model, and stored. At ask-time the query *q* is mapped
by the same model to *e(q)*, and the system returns the *k* passages whose
vectors are nearest *e(q)* by cosine similarity (a top-*k* dense retrieval;
Karpukhin et al. 2020). Those *k* passages are concatenated into the model's
context with an instruction to answer from them and cite them. Two design
choices matter for what follows. The retrieval is *dense-only*: it matches on
learned semantic similarity, not on shared words, which is a strength for
paraphrase and a documented weakness for exact terms (§5). And *k* is small
and fixed, so the system sees a handful of passages, never the whole work,
which is why arguments that live across many passages fall outside its reach
(§5). The lexical alternative, term-frequency scoring such as BM25 (Robertson
& Zaragoza 2009), has the mirror-image profile, and the two are usually best
combined (§5).

Applied to a classical archive (Cicero's letters, Caesar's commentaries,
Augustus's *Res Gestae*, Seneca's letters, Marcus Aurelius's *Meditations*,
with Pliny and Quintilian to follow), the approach has real strengths and
real limits, and it is easy to oversell both. This essay tries to price it
accurately.

## 2. Why a classical corpus suits retrieval unusually well

A classical corpus is finite, edited, and stable: exactly the conditions
under which retrieval is reliable. There is a definite set of texts; each has
a canonical reference scheme refined over centuries precisely so that any
passage can be pointed to unambiguously; and the words do not change between
one query and the next. Retrieval systems built for the open web must cope
with churn, spam, and boundless scale; the Roman Archive is a fixed,
catalogued collection.

Against such a corpus, retrieval can find the passages that bear on a
question (Cicero's mood before his exile, the honours Augustus records at
the close of his life, how Marcus steadies himself against the fear of
death) and hand them to the model as evidence. The model's task is then
narrow and checkable: read these passages, and answer from them.

The canonical reference scheme does quiet but important work here. Because
every retrieved unit carries its *Att.* or *B.G.* or *R.G.* number, the
citation works as a join key between the answer and two millennia of
scholarship. A reader who wants more than the Archive can give can walk
*Att.* 1.16 straight into any commentary ever written.

## 3. Grounding makes error visible, not impossible

Grounding constrains the failure mode people rightly fear. A model asked
about a Roman figure from parametric memory alone will sometimes produce
fluent, confident, wrong statements: a plausible letter never written, a
saying misattributed, a date that is almost right (Ji et al. 2023).
Grounding the answer in retrieved text does not make hallucination
impossible (the model can still misread, overstate, or blend its passages),
but it makes error *checkable*: an answer with no supporting passage is a
visible flag, and the question "is this sentence supported by its citation?"
is one that both humans and automated methods can actually answer (Rashkin
et al. 2023; Bohnet et al. 2022; Es et al. 2024).

The classical case adds a specific twist: the model's parametric memory of
these authors is enormous. Any modern model has read more *about* Caesar than
this Archive contains *by* him. Grounding therefore does different work here
than in an obscure-domain RAG system: rather than supplying knowledge the
model lacks, it fences the model off from knowledge it has. The discipline
is subtractive. The failure the system must prevent is the silent
substitution of the biographical tradition (Plutarch's Caesar,
Shakespeare's, the internet's) for the primary text.

## 4. Scoping as a correctness property

Because the archive holds more than one author, retrieval is scoped by
author, and this carries more weight than it first appears to. When you ask
Marcus Aurelius a question, the search runs over his *Meditations* only;
Cicero's letters are absent entirely, rather than merely ranked lower. A
bounded figure never reasons from a text he could not have known, and the
emperor of the second century does not borrow the words of a republican dead
before he was born. The Classicist alone ranges across the whole collection,
because that is the one voice standing outside it.

The Archive applies the same mechanism to a second boundary: primary versus
reference. Background material (Smith's *Dictionary of Greek and Roman
Antiquities*, Fowler's *Social Life at Rome*) is embedded but flagged, held
out of retrieval by default, and marked `[BACKGROUND]` when the scholarly
persona draws on it. The lesson generalises: in a RAG system over any corpus
with internal provenance structure, provenance should be enforced at
retrieval time, as a filter, rather than requested at generation time, as an
instruction. A model cannot leak what it was never shown.

## 5. What retrieval misses

Now the limits, which are just as important. Retrieval finds what is
lexically or semantically near the query, and it can miss what a scholar
would see:

- **Arguments that live across documents.** Cicero's slide from confidence to
  despair across the letters of 59–58 BC is real and documented, but it is a
  *trajectory*, present in no single letter. Top-k retrieval returns
  passages, not arcs. This is the classical case of *multi-hop* reasoning,
  where an answer requires chaining several passages that are individually
  only weakly related to the query and to each other; single-shot dense
  retrieval scores each passage against the query independently and so tends
  to surface the passages near the question while missing the bridging ones
  (the difficulty that motivated multi-hop benchmarks such as HotpotQA, Yang
  et al. 2018). Iterative or multi-step retrieval can partly recover such
  chains, but it is not implemented here, and no amount of top-k tuning
  substitutes for it.
- **Meaning by omission.** The *Res Gestae* never names Antony; the
  *Commentarii* pass in silence over what a legate's defeat cost politically.
  A silence cannot be embedded, retrieved, or cited, yet it is often the
  most historically telling thing about a text. RAG is good at "what does
  this author say about X" and weak at "what does it mean that this author
  says nothing about X".
- **Irony and register.** Whether Cicero is being sincere or performing for a
  correspondent is a judgement built from hundreds of letters and a century
  of scholarship, not from any retrievable span.
- **Lexical blind spots.** Dense retrieval can miss exact-match queries
  (rare proper names, offices, specific citations) that a keyword search
  would catch trivially; the pattern is well documented across retrieval
  benchmarks (Thakur et al. 2021). A corpus whose queries are full of names
  like Clodius, Vatinius, and Brundisium lives exactly in this regime. The
  standard remedies are hybrid fusion of dense retrieval with lexical BM25
  scoring (Robertson & Zaragoza 2009), combined by reciprocal rank fusion
  (Cormack et al. 2009), plus rerankers and query expansion (HyDE; Gao et al.
  2023); for this Archive they are planned measurements rather than delivered
  properties.

Retrieval surfaces evidence; it does not, on its own, interpret. That
division of labour frames everything the system does.

## 6. Traps specific to this corpus

- **Retrieval runs over translations.** Several texts are English renderings
  of a Latin or Greek original, and the embedding space is the translator's
  English (Casaubon's 1634 *Meditations* above all). A query phrased in
  modern Stoic vocabulary may miss a passage the Greek would match, because
  the match is mediated by a seventeenth-century paraphrase; conversely the
  English may offer a match the original would not support. The companion
  essay on translation develops this fully.
- **The texts assume a world.** Roman names, offices, dates, and
  institutions form a dense web the query language may not share.
  "Praetor", "proscription", and "the Ides" carry loads a general reader's
  question won't articulate, which is one motivation for the Archive's gated
  reference layer.
- **Each corpus is partial, by survival or by design.** One side of a
  correspondence; a general's own account of his wars; an emperor's official
  self-summary. Absence of evidence in retrieval is not evidence of absence
  in history, and a well-behaved persona must say "my record does not speak
  of this" rather than let the gap read as fact.

## 7. The wider tooling, and what is not yet used

This Archive sits inside a mature digital-classics ecosystem it does not yet
fully exploit. The texts come from the Perseus Digital Library's canonical
corpora (Smith, Rydberg-Cox & Crane 2000). Latin-specific NLP now offers
lemmatised search and Latin-aware embeddings: the Classical Language Toolkit
(Johnson et al. 2021), Latin BERT (Bamman & Burns 2020), and LatinCy (Burns
2023), any of which could let retrieval see the Latin column rather than
only the translators' English. Deep networks have been used to restore and
attribute Greek inscriptions in genuinely philological work (Assael et al.
2022). Against that backdrop, this Archive's contribution is the reading
architecture rather than any retrieval technique: grounding, scoping, and
citation discipline arranged so that a general reader can question a
classical corpus and check every answer.

## 8. Summary

RAG turns a classical archive into something you can question directly and
verify as you go: a genuine gain over both unaided model memory and ordinary
search, and one that classical corpora, with their stable texts and canonical
references, are unusually well placed to collect. It fences a fluent model
off from the vast secondary tradition and holds it to the primary record. But
it is a reading aid, not a reader. It can put the right passages in front of
you and hold itself to them; the weighing of those passages (the trajectory
across a correspondence, the meaning of a silence, the judgement that is the
actual work of reading) it leaves, rightly, to you.

---

## References

- Assael, Y. et al. (2022). Restoring and attributing ancient texts using
  deep neural networks. *Nature* 603, 280–283.
- Bamman, D. & Burns, P. J. (2020). Latin BERT: A Contextual Language Model
  for Classical Philology. arXiv:2009.10053.
- Bohnet, B. et al. (2022). Attributed Question Answering. arXiv:2212.08037.
- Burns, P. J. (2023). LatinCy: Synthetic Trained Pipelines for Latin NLP.
  arXiv:2305.04365.
- Cormack, G. V., Clarke, C. L. A. & Buettcher, S. (2009). Reciprocal Rank
  Fusion Outperforms Condorcet and Individual Rank Learning Methods. *SIGIR
  2009*.
- Es, S., James, J., Espinosa-Anke, L. & Schockaert, S. (2024). RAGAS:
  Automated Evaluation of Retrieval Augmented Generation. *EACL 2024: System
  Demonstrations*.
- Gao, L., Ma, X., Lin, J. & Callan, J. (2023). Precise Zero-Shot Dense
  Retrieval without Relevance Labels (HyDE). *ACL 2023*.
- Ji, Z. et al. (2023). Survey of Hallucination in Natural Language
  Generation. *ACM Computing Surveys* 55(12).
- Johnson, K. P. et al. (2021). The Classical Language Toolkit: An NLP
  Framework for Pre-Modern Languages. *ACL 2021: System Demonstrations*.
- Karpukhin, V. et al. (2020). Dense Passage Retrieval for Open-Domain
  Question Answering. *EMNLP 2020*.
- Lewis, P. et al. (2020). Retrieval-Augmented Generation for
  Knowledge-Intensive NLP Tasks. *NeurIPS 33*.
- Rashkin, H. et al. (2023). Measuring Attribution in Natural Language
  Generation Models. *Computational Linguistics* 49(4).
- Robertson, S. & Zaragoza, H. (2009). The Probabilistic Relevance Framework:
  BM25 and Beyond. *Foundations and Trends in Information Retrieval* 3(4),
  333–389.
- Smith, D. N., Rydberg-Cox, J. A. & Crane, G. R. (2000). The Perseus
  Project: a Digital Library for the Humanities. *Literary and Linguistic
  Computing* 15(1), 15–25.
- Thakur, N. et al. (2021). BEIR: A Heterogeneous Benchmark for Zero-shot
  Evaluation of Information Retrieval Models. *NeurIPS Datasets and
  Benchmarks*.
- Yang, Z. et al. (2018). HotpotQA: A Dataset for Diverse, Explainable
  Multi-hop Question Answering. *EMNLP 2018*.

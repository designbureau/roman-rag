# Cicero Archive — Project Plan & Handover

> **Purpose of this file.** A self-contained handover for a new session. It
> captures (1) what we're building, (2) the decisions already locked with the
> user, (3) the full implementation plan, (4) the empirically-validated source
> findings from a working proof-of-concept, and (5) the exact next step and
> current blocker. A fresh session should be able to execute from this file
> alone.

---

## 1. What this is

A new, **standalone** project that clones the architecture of the **Bleek-Lloyd
Archive** (this repo) and re-points it at **Cicero** — ingesting his complete
works as a **Latin + English parallel corpus** and giving them voice through a
**Roman ensemble** of personas.

The Bleek-Lloyd stack is genuinely source-agnostic: `scrape → embed → pgvector
retrieval → persona-shaped Claude generation`. The only domain-specific parts
are the **scrapers**, the **personas**, the **glossary/topics extraction**, and
the **theming**. This project replaces exactly those parts.

Transferable principles being carried over: multi-voice personas presenting
*identical retrieved passages* in different registers; strict
retrieval-grounding + in-voice citation discipline; parallel original/English
text; a layered glossary; author/theme analytics; and the editorial
"print-on-warm-stone" aesthetic.

---

## 2. Decisions locked with the user

| # | Decision | Choice |
|---|---|---|
| 1 | Repo & infra | **Standalone repo + its own Supabase project** (isolated data, keys, Vercel deploy). Repo created: **`designbureau/roman-rag`**. |
| 2 | Personas | **Roman ensemble**, each voice bounded to its own knowledge. |
| 3 | First-build corpus | **Cicero's own works only** (speeches, letters, philosophica, rhetorica). Context authors (Livy/Sallust/Plutarch) are a later phase. |
| 4 | Language | **Latin + English parallel** per passage, plus a Latin glossary. |
| 5 | Build sequence | **Full scaffold first** (copy monorepo, rename schema/types, set up packages + forked migration), then ingestion. |
| 6 | Model | Keep a **temperature-accepting model (Claude Sonnet)** for chat generation — per-persona temperature (0.7–0.9) is load-bearing for the persona "looseness" knob. (Newer models such as Opus 4.8 reject the `temperature` param; if you move to one, repurpose the column as an effort/looseness hint.) Embeddings stay OpenAI `text-embedding-3-small`. |

### Prerequisites the user must provision (outside agent push scope)
- **GitHub repo** `designbureau/roman-rag` — ✅ created by the user (the GitHub integration token could not create it: `403 Resource not accessible by integration`).
- **Supabase project** (pgvector enabled) → `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **API keys**: `OPENAI_API_KEY` (embeddings), `ANTHROPIC_API_KEY` (chat), `ELEVENLABS_API_KEY` (TTS, optional at first).
- **Vercel project** for the web app (later).

---

## 3. Implementation plan — clone, then replace five layers

Copy the whole monorepo (`packages/cli`, `packages/shared`, `supabase`, `web`,
`docs`) into the new repo, then work through the layers. Build in phases so the
pipeline is proven end-to-end on a small slice before scaling.

### Layer 1 — Data model & schema (`packages/shared`, `supabase/migrations`)
Fork `supabase/migrations/20260505000000_initial.sql` into a fresh initial
migration; mirror in `packages/shared/src/types.ts` (`Story`, `Source`,
`SearchResult`):

| Bleek-Lloyd field | Cicero field | Meaning |
|---|---|---|
| `xam_text` | `latin_text` | Latin original of the passage |
| `bleek_lloyd_ref` | `cicero_ref` | canonical citation, e.g. `Att. 1.5`, `Cat. 1.1`, `N.D. 2.18` |
| `informant` | `addressee` (keep column name `informant` to cut churn; repurpose semantics) | letter recipient; null for non-letters |
| `category` | `genre` | `oration` \| `letter` \| `dialogue` \| `treatise` \| `rhetorica` |
| `mantis_cycle` | *drop* | replaced by `genre` |
| — | `translator`, `edition` (new) | provenance |
| `language` | constant `"la"` | retrieval default |

- Update the `search_chunks` RPC filter args (`filter_addressee`, `filter_genre`).
- Add a **`glossary` side table** (lemma, pos, gloss, freq, example `cicero_ref`, source-layer) — keyword lookup, not vector chunks.
- New `SOURCES`: `orations`, `letters-att`, `letters-fam`, `letters-qfr`, `letters-brut`, per-work treatise ids (`de-officiis`, `de-natura-deorum`, `de-divinatione`, `de-finibus`, `de-senectute`, `de-amicitia`, `de-legibus`, `de-re-publica`, `tusculanae`, `academica`, `paradoxa-stoicorum`), plus `rhetorica`.
- Keep later migrations verbatim: `dynamic_personas`, `persona_age_tiers`, RLS hardening (`20260630*`). Drop `images`/rock-art for now.

### Layer 2 — Ingestion (`packages/cli/src/scrape`, `.../embed`)
**Primary source: Perseus `canonical-latinLit`, author `phi0474` (Cicero)** — a
`git clone` of the GitHub repo into `data/.cache/perseus/` (no live scraping).
See §4 for the validated structure & alignment approach.

New modules under `scrape/sources/` (replacing the eight Bleek-Lloyd scrapers):
- `perseus-tei.ts` — shared TEI walker: `work XML → Map<ref, {text, notes}>`.
- `work-registry.ts` — maps each `phiNNN → {source, genre, abbrev, title, latEdition, engEdition|fallback}`, built from each folder's `__cts__.xml`.
- `cicero-letters-att.ts`, `cicero-letters-fam.ts`, `cicero-letters-qfr.ts`, `cicero-letters-brut.ts` — letters, `informant`=addressee, **whole-letter** granularity.
- `cicero-orations.ts`, `cicero-philosophica.ts`, `cicero-rhetorica.ts` — **section** granularity (keeps each `Story` chunk-sized).
- `english-fallback-gutenberg.ts` / `english-fallback-lacuscurtius.ts` — only for works lacking a Perseus English edition; coarse-unit alignment, flagged `align_method`.
- `glossary-build.ts` — see Layer 4.

Ingestion order: clone → build registry → letters → philosophica → orations →
rhetorica → English fallbacks → glossary → `pnpm embed`.

**Reuse** `embed/chunk.ts` + `embed/index.ts` (story + paragraph chunks,
idempotent diff-embed). Two adjustments: (a) length guard in `buildStoryChunk`
— skip the story-level chunk if `english_text` > ~6k tokens; (b) replace the
provenance preface (informant) with translator/edition + `cicero_ref`.

**Scale:** ~60 works; ~800 letters (1 Story each); section-granular
treatises/speeches → roughly 8–15k parallel-passage Stories.

**Licensing:** Perseus *markup* is CC BY-NC-SA 3.0 US, but the underlying
Latin/English **texts are public domain**. Ingest the text content (strip
Perseus-specific markup), store `translator`+`edition`, attribute the underlying
public-domain print editions (Teubner/Purser; Shuckburgh, Yonge, Falconer).
**Avoid** in-copyright modern Loeb/Penguin/OUP translations and Shackleton Bailey.

### Layer 3 — Personas (`supabase/functions/_shared/personas`, `.../chat/index.ts`)
Same mechanism (code built-ins inheriting `SHARED_RULES` + few-shots +
temperature; data-driven rows via `/admin`). **Retrieval never varies by
persona.** `mantis.ts` is the template for a first-person bounded figure.

**Phase-1 built-ins** (work on a Cicero-only corpus):
- `classicist` (default, 0.7) — modern scholar; Archivist analogue; candid about translation/transmission.
- `cicero` (0.75) — first-person showcase; bounded 106–43 BC; **never narrates his own death or the future**; cites in-voice ("when I prosecuted Verres").
- `tiro` (0.7) — freedman secretary; the Lloyd-analogue **recorder**; *outlives* Cicero, so may speak the meta-frame (shorthand, how letters were edited/published).
- `atticus` (0.75) — urbane confidant; voices the correspondence from the receiving end (454 surviving letters are to him).
- `caesar` (0.7) — contemporary adversary; **delicately bounded: died Ides of March 44 BC** — hard-block the Philippics, his assassination, the proscriptions, Cicero's death.
- `interpreter` (0.75) — plain-English of hard passages; no padding.
- `storyteller` (0.8) — accessible retelling; preserves strangeness.

**Phase-2 (admin-authored, `enabled=false` until context texts exist):**
`sallust`, `livy`, `biographer` (Plutarch-style). On a Cicero-only corpus they'd
refuse everything or fabricate, so they wait for their own texts.

**`SHARED_RULES` rewrite** (`shared.ts`): period-preservation retargeted to
translated/quoted Latin; Latin terms instead of clicks; a prominent **"never
invent speeches or letters"** rule (highest risk — the biographical tradition is
famous and tempting); "keep periods distinct" → three separations (Republic vs
Empire; primary text vs biographical tradition; speech vs letter vs treatise);
generalise the per-speaker death-bound pattern; drop the rock-art rule.

**Voice profiles** (`topics/voice-profiles.ts`): generalise the hardcoded
Lloyd/Bleek list to config-driven; swap click handling for Latin lemmatisation
+ Latin stopwords. Cicero: profile Latin+English, segmented by genre. Caesar:
profile the public-domain *Commentarii*. **Tiro/Atticus have no surviving
prose** → derive register from the letters Cicero wrote *to* them (+ Nepos's
*Life of Atticus*) and ship a clearly-labelled **reconstructed** voice reference.

### Layer 4 — Analytics & glossary (`packages/cli/src/topics`)
The corpus has **no transcriber subject tags**. Replace that signal with:
(a) **structural metadata** (work, genre, addressee, date, place) as facets, and
(b) a one-time **LLM thematic-tagging pass** writing a grounded,
controlled-vocabulary `themes[]` onto each record (the only genuinely new build
stage). Then the existing builders carry over:
- **/topics, /graph** — term-freq + co-occurrence over `themes[]` (same algorithms; the bubble-chart restyle already in `web/app/routes/graph.tsx` carries over).
- **/heatmap** — three modes: **genre × theme** (default), **addressee × theme** (letters), **year × theme** (the arc: courts → consulship → philosophy → Antony).
- **/library** — group by genre; letters sub-grouped by collection; date extraction retargeted to BC years.
- **/glossary (Latin)** — three-layer authority: corpus-mined Latin terms → **Lewis & Short (1879, public domain)** canonical → **Smith's *Dictionary of Greek and Roman Antiquities*** for institutional/cultural terms. Replace click canonicalisation with **lemmatisation** (inflected form → headword); tooltip keys on lemmas.

### Layer 5 — Frontend re-theme (`web`)
Pure UI fork — no persona-specific code. Replace identity strings and restyle:
- `root.tsx` (title/meta), `auth-gate.tsx`, `_index.tsx` (h1/description/footer), every route `meta()`.
- `persona-toggle.tsx` `FALLBACK_PERSONAS`; `citations-panel.tsx` name map; `filter-bar.tsx` (informant→addressee, source→collection lists); `content/papers.ts`.
- `globals.css` tokens — shift the single accent from terracotta to a Roman register (imperial purple / Pompeian red); keep warm-stone, zero-shadow, serif aesthetic; mono sigla for manuscript refs.
- `lib/natural-ask.ts` / `rehype-glossary-tooltip.ts` — Latin-aware (no articles; lemma matching).
- New **papers**: reading Cicero in translation; the ethics of giving historical figures synthetic voice; what RAG can/can't do for a classical corpus.

---

## 4. Validated source findings (proof-of-concept on real data)

A working POC aligned the real Perseus **Letters to Atticus** to de-risk the
linchpin assumption (parallel Latin/English alignment). Results below are
empirical, not assumed.

### Perseus `phi0474` (Cicero) layout
- All ~60 Cicero works present: folders `phi001`–`phi059` + `phi072`, each with a `__cts__.xml`.
- **Edition naming varies** — do not hardcode `lat2`/`eng1`. Atticus is `phi0474.phi057.perseus-lat1.xml` (Purser, OCT 1903) + `phi0474.phi057.perseus-eng1.xml` (Shuckburgh, 1908). Read each work's `__cts__.xml` to discover its actual `<edition>`/`<translation>` URNs.
- Key works: letters `phi057` (ad Att.), `phi056` (ad Fam.), plus ad Q.fr. / ad Brut.; orations across many `phiNNN`; philosophica & rhetorica the rest.

### Alignment approach (validated)
- **Latin** (`lat1`, Purser): nested `div type="textpart"` with `subtype` book → letter → section; ref = `book.letter.section`.
- **English** (`eng1`, Shuckburgh): the *source* edition is chronological (its `refsDecl` header says volume/page/year — **misleading**), BUT the actual body divs are keyed traditionally: `n="text=A:book=1:letter=5" type="letter"` (whole letter, no sections).
- **So: align letters at WHOLE-LETTER granularity** — collapse the Latin's sections up to `(book, letter)` and join on the English `(book, letter)` parsed from `text=A:book=N:letter=M`. (Treatises/orations align at section level where both editions share that scheme.)

### Measured coverage (ad Atticum)
- Latin letters: **446**; English letters: **428**.
- Raw join on `(book, letter)`: **381 aligned (85.4%)**.
- With trivial **case-normalised suffix** (`4A`→`4a`): **414 aligned (92.8%)**.
- Remainder (~7%) is genuine **editorial sub-lettering** (`5a/5b/5c` splits differ between Purser and Shuckburgh) and a few standalone letters → handle with the plan's `align_method` flag and the "never drop a side; ingest with the missing side null" rule.

### Refinements the production scraper must include
1. **Edition discovery** from `__cts__.xml` (don't assume lat2/eng1).
2. **Case-normalise** letter suffixes before joining; record raw + normalised ref.
3. **Strip Shuckburgh's per-letter editorial headnote** from the translated body — the POC's English for `Att. 1.1` captured the historical argument ("B.C. 65. Coss., L. Aurelius Cotta…") ahead of the translation. Separate the `<head>`/argument from the letter text.
4. **Drop `<note>`** (editorial notes) from body text (POC already does).
5. Letter numbers can be non-numeric (`6A`) — parse with a `(\d+)(\D*)` split for sorting.

### Sources & licensing quick-map
- **Primary (both languages):** Perseus `canonical-latinLit` `phi0474` — `git clone https://github.com/PerseusDL/canonical-latinLit`.
- **English fallbacks** (works lacking a Perseus translation): Project Gutenberg (Yonge orations/philosophica; Shuckburgh letters), LacusCurtius (Falconer *De Divinatione*, public-domain Loebs only — verify each page's copyright note).
- **Letter-numbering crosswalk aid:** Attalus.org (`/refs/CicAtt.html`).
- **Glossary:** Lewis & Short (1879, PD) + Smith's *Dictionary of Greek and Roman Antiquities* (PD).
- **Avoid:** in-copyright Loeb revisions, Penguin/OUP moderns, Shackleton Bailey, Wikipedia prose-as-corpus, live high-volume scraping of Scaife/Perseus (clone the GitHub repo instead).

### Reproduce the POC
The validating script (stdlib Python; fetches the two Atticus TEI files and
prints coverage + writes parallel `Story` records). Re-run in any session:

```python
import re, json, xml.etree.ElementTree as ET, urllib.request
TEI = "{http://www.tei-c.org/ns/1.0}"
BASE = "https://raw.githubusercontent.com/PerseusDL/canonical-latinLit/master/data/phi0474/phi057/"
def fetch(name):
    return ET.fromstring(urllib.request.urlopen(BASE + name).read())
def text_of(el):
    parts = []
    for n in el.iter():
        if n.tag.replace(TEI, "") == "note":  # drop editorial notes
            continue
        if n.text: parts.append(n.text)
        if n.tail: parts.append(n.tail)
    return re.sub(r"\s+", " ", " ".join(parts)).strip()
def body(root): return root.find(f"{TEI}text/{TEI}body")
def norm(s): return s.lower()           # 4A -> 4a

lat = {}
for book in body(fetch("phi0474.phi057.perseus-lat1.xml")).iter(f"{TEI}div"):
    if book.get("subtype") != "book": continue
    for letter in book.findall(f"{TEI}div"):
        if letter.get("subtype") == "letter":
            lat[(book.get("n"), norm(letter.get("n")))] = text_of(letter)
eng = {}
for d in body(fetch("phi0474.phi057.perseus-eng1.xml")).iter(f"{TEI}div"):
    if d.get("type") != "letter": continue
    m = re.search(r"book=(\w+):letter=(\w+)", d.get("n", ""))
    if m: eng[(m.group(1), norm(m.group(2)))] = text_of(d)

both = sorted(set(lat) & set(eng))
print(f"Latin {len(lat)}  English {len(eng)}  aligned {len(both)}  "
      f"coverage {100*len(both)/len(lat):.1f}%")
# -> Latin 446  English 428  aligned 414  coverage 92.8%
```

---

## 5. Phasing & verification

**Phasing:**
1. Scaffold: fork repo, new Supabase project, run forked migrations, set env/secrets.
2. Vertical slice (proof): ingest **ad Atticum only** → embed → deploy `chat` with `classicist` + `cicero` → confirm grounded, cited, parallel-text answers.
3. Personas: add `tiro`, `atticus`, `caesar`, `interpreter`, `storyteller`; rewrite `SHARED_RULES`; voice profiles.
4. Full corpus: orations, philosophica, rhetorica, remaining letters; English fallbacks.
5. Analytics: LLM theme-tagging pass → topics/graph/heatmap/library/glossary.
6. Frontend re-theme + new papers; Vercel deploy.
7. Phase 2 (separate): ingest Livy/Sallust/Plutarch; enable `sallust`/`livy`/`biographer`.

**Verification:**
- Ingestion: spot-check `data/stories.json` — Latin/English on the same `cicero_ref`, addressee/genre correct, no empty `latin_text`; assert join coverage %.
- Embedding: `chunks` row counts; `search_chunks` returns sane cosine hits ("the conspiracy of Catiline" → Catilinarian sections).
- Chat: `supabase functions serve`; per persona confirm (a) claims trace to retrieved passages, (b) in-voice citation, (c) bounded refusals (ask `caesar` re the Philippics → "I did not live to hear them"; ask `cicero` to predict the future → refuse), (d) **no invented letters/speeches**.
- Analytics: build JSONs; load `/topics`, `/graph`, `/heatmap`, `/glossary`, `/library`; verify heatmap modes + glossary lemma lookup.
- `pnpm typecheck`, `pnpm build:web` (with env set).

**Top risks:** hallucinated speeches/letters (covered by the SHARED_RULES rule +
persona bounds + retrieval-grounding — verify explicitly); cross-editor English
aligns only at coarse units (flag `align_method`, prefer Perseus-native pairs);
reconstructed Tiro/Atticus voices must be labelled as reconstruction.

---

## 6. Current status & the immediate next step

- ✅ Architecture mapped; plan approved; key design decisions locked (§2).
- ✅ Linchpin de-risked on real data — Perseus parallel-text alignment works (§4): 92.8% coverage on ad Atticum, with the production refinements identified.
- ✅ Standalone repo created: **`designbureau/roman-rag`**.
- ✅ Full scaffold landed (commit `86c8070`): monorepo skeleton, Layer-1 type/schema renames (`latin_text`, `cicero_ref`, addressee/genre, `SOURCES`, Roman `BuiltinPersona` set), `.env.example`.
- ✅ **Phase-2 ingestion (production) — Letters to Atticus** is implemented and verified on live Perseus data (see below).
- ✅ **Supabase project provisioned** — `roman-rag`, ref **`zypnwehtzzwxlepyrbjh`**, org Swanky, region **eu-west-2**, Postgres 17 + pgvector. Data-plane migrations applied; corpus tables RLS-locked (service-role-only). URL/anon key written to gitignored `.env`.
- ✅ **ad Atticum embedded + retrieval verified** — `pnpm embed` loaded 460 stories / **1214 chunks** (OpenAI `text-embedding-3-small`). Cicero eval fixture (`packages/cli/src/eval/queries.json`) scores **Recall@10 = 1.000, MRR@10 = 1.000** (5/5, all rank 1): e.g. "death of my cousin Lucius" → `Att. 1.5`, "conspiracy of Catiline" → `Att. 1.16`. **The vertical-slice data path (scrape → embed → pgvector) is proven end-to-end.**
- ✅ **Layer-3 chat rewritten (code) — Phase-1 voices `classicist` + `cicero`.** `supabase/functions/chat/index.ts` rewritten from the ground up for Cicero: new Cicero `SHARED_RULES` (the "never invent a speech/letter/Latin" rule; the three separations — Republic/Empire, primary-text/biographical-tradition, speech/letter/treatise; generalised in-life temporal bounds); `classicist` (default, temp 0.7, candid modern scholar, reads-in-translation) and `cicero` (temp 0.75, first-person, bounded 106–43 BC — never narrates his own death or the future). `retrieve()` fixed to match the deployed RPC (no `filter_language`); `formatContext` now includes `latin_text` for parallel-text answers; |xam image/notebook/age-tier machinery removed; persona_config dynamic-merge + GET admin endpoint preserved (degrades to code built-ins when the table is absent). Model stays **`claude-sonnet-4-6`** — the newest Sonnet that still accepts the load-bearing per-persona `temperature` (Sonnet 5 / Opus 4.7+ reject it with a 400). Dead Bleek-Lloyd `_shared/personas/*` deleted. Frontend `FALLBACK_PERSONAS` → classicist/cicero.
- ⏭ **Next: deploy `chat`** (needs `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` as Edge Function secrets) and run the §5 in-voice verification; then write the deferred `profiles`/`handle_new_user` + Cicero `language_groups` + Roman-ensemble `persona_config` migrations and add Phase-3 voices (tiro, atticus, caesar, interpreter, storyteller).

**Supabase provisioning — applied vs deferred (this session):**
- Applied (data plane): `initial` (stories, chunks, `search_chunks`, vector ext), `images` (empty table, kept so the RLS migration resolves), `search_chunks_cicero_ref`, `enable_rls_corpus_tables`, `pin_search_fn_search_path`.
- **Deferred to Layer 3** (they depend on a `profiles` table + `handle_new_user()` trigger that NO migration creates — they were set up out-of-band in the original prod — and/or seed the *Bleek-Lloyd* personas): `language_groups` (also still carries |xam `UPDATE`s + entangled with chat's language filter), `dynamic_personas`, `persona_age_tiers`, and the `handle_new_user()` revoke from `harden_functions`. When adapting Layer 3: write the missing `profiles`/`handle_new_user` migration first, Cicero-ise `language_groups` (default `language='la'`, drop the |xam updates), and re-seed `persona_config` with the Roman ensemble instead of archivist/mantis/lloyd/bleek/earlyrace.
- **Secrets still required** (not retrievable via MCP — add to `.env`): `SUPABASE_SERVICE_ROLE_KEY` (dashboard → Project Settings → API), `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Embedding (`pnpm embed`) is blocked until the service-role + OpenAI keys are present.

**Done in this session — ad Atticum ingestion (Layer 2):**
- `scrape/sources/perseus-tei.ts` — TEI loader + `cleanText` (drops `<note>/<head>/<epigraph>/<argument>/<pb>`, turns `<milestone unit="para"/>` into paragraph breaks) + `scaifeUrl`.
- `scrape/sources/work-registry.ts` — edition discovery from `__cts__.xml` (no hardcoded `lat2/eng1`; derives TEI filenames from the `<ti:edition>`/`<ti:translation>` URNs). `ATTICUS` work descriptor.
- `scrape/sources/cicero-letters-att.ts` — whole-letter alignment on `(book, case-normalised letter)`; "never drop a side" (union of both editions); emits parallel `Story` records with `latin_text`/`english_text`/`cicero_ref`/addressee/genre/translator/edition.
- Registered as `letters-att` in `scrape/index.ts`; unit-tested in `cicero-letters-att.test.ts` (10 tests).
- **Verified:** `pnpm scrape --source=letters-att` → `Latin 446  English 428  aligned 414 (92.8%)`; `data/stories.json` has 460 unique stories (414 fully parallel), 0 empty, no leaked editorial argument/headnote, sub-letters (`Att. 10.12A`) handled.

**Known pre-existing scaffold debt (NOT from this slice; in not-yet-adapted layers):**
- `packages/cli/src/db/migrate.ts` fails typecheck — it uses a `postgres`-style tagged-template `sql` but `db/client.ts` was ported to the Supabase REST client. It is a local-dev convenience only (prod migrations go via the Supabase MCP `apply_migration`); decide later whether to delete it or reimplement against a direct PG connection.
- `packages/cli/src/topics/build.ts` fails typecheck — still Bleek-Lloyd Layer-4 analytics (parses `"Indexed under:"`/notebook text absent from the Cicero corpus). Will be replaced by the LLM theme-tagging pass (Layer 4).

**Immediate next step:**
1. Provision the Supabase project + `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`; run the forked migrations (Supabase MCP `apply_migration`).
2. `pnpm embed` the ad Atticum `stories.json`; spot-check `search_chunks` (e.g. "death of my cousin Lucius" → `Att. 1.5`).
3. Rewrite Layer-3 personas to the Roman ensemble (start with `classicist` + `cicero`; rewrite `SHARED_RULES`), replace the Bleek-Lloyd built-ins in `supabase/functions/chat/index.ts`, deploy `chat`, and confirm grounded, in-voice, parallel-text answers (§5 verification).

> Reference: the long-form approved plan also lives at
> `/root/.claude/plans/i-d-like-to-create-cosmic-rainbow.md` in the originating
> session's environment (not in this repo, and not guaranteed to persist). This
> file is the authoritative, portable copy.

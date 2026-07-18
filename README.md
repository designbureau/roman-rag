# Voces Romae: the Roman Archive

A retrieval-augmented reading interface to a multi-author corpus of Roman
prose. The words of Cicero, Caesar, Augustus, Seneca, and Marcus Aurelius are
made readable, searchable, and answerable: you can put a question to any of
them and get a reply grounded strictly in their own surviving writings, in
English with the original Latin alongside where it survives.

The front door is an *exedra*: a three-dimensional hall of sculpted busts,
rendered in WebGL, that you address by typing or by voice, and that answer
aloud. Behind it is a conventional retrieval-augmented generation pipeline
held to an unconventional discipline: every claim must trace to a retrieved
passage, no persona invents a letter or a line it never wrote, and each figure
knows only what fell within their own lifetime.

The project is a standalone fork of the Bleek–Lloyd ǀxam archive architecture,
re-pointed at Rome. The long-form write-ups in [`docs/`](docs/) (also served
in-app under `/papers`) cover the system, the ethics of giving the dead a
voice, what RAG can and cannot do for a classical corpus, and reading Rome in
translation.

**Live:** https://roman-rag.vercel.app

---

## Contents

- [How it works](#how-it-works)
- [The corpus](#the-corpus)
- [The personas](#the-personas)
- [Stack](#stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [The data pipeline](#the-data-pipeline)
- [Edge functions](#edge-functions)
- [Deployment](#deployment)
- [Authentication](#authentication)
- [Accessibility](#accessibility)
- [Scripts](#scripts)
- [Documentation](#documentation)
- [Sourcing and licensing](#sourcing-and-licensing)
- [Acknowledgements](#acknowledgements)

---

## How it works

Each passage in the corpus is embedded once and stored in a pgvector table. At
ask-time the user's question is embedded, the nearest passages by cosine
similarity are retrieved, and they are handed to Claude as evidence with
instructions to answer from them and cite them. The retrieved passages are
returned to the client alongside the reply so the reader can see the source.

Two retrieval-time filters carry the system's integrity:

- **Author scoping.** Each first-person persona is filtered to its own
  author's works, so Marcus Aurelius cannot reason from Cicero's letters and
  Augustus cannot borrow Seneca's aphorisms. A model cannot quote what
  retrieval never shows it, which is what makes the temporal and evidential
  bounds enforceable rather than merely requested.
- **A reference gate.** Encyclopaedic background (Smith's *Dictionary of Greek
  and Roman Antiquities*, W. Warde Fowler's *Social Life at Rome*) is embedded
  but flagged `is_reference`, held out of retrieval by default, and marked
  `[BACKGROUND]` when the scholarly persona draws on it, so a Victorian
  dictionary entry is never voiced as a Roman's own words.

Replies are streamed, spoken aloud through per-persona ElevenLabs voices with
word-level timing, and displayed with the parallel Latin where the source
carries it. Voice input is transcribed by OpenAI Whisper.

## The corpus

Sources are ingested as parallel Latin/English passages where both survive.
Figures below are what is scraped into `data/stories.json`; the "Live" column
marks what is embedded and behind retrieval in production.

| Source | Passages | Original | Translation | Live |
|---|---:|---|---|:-:|
| Cicero, *Epistulae ad Atticum* | 460 | 446 Latin (414 parallel) | Shuckburgh (1899–1900) | yes |
| Caesar, *De Bello Gallico* | 404 | 404 Latin | McDevitte & Bohn (1870–72) | yes |
| Caesar, *De Bello Civili* | 247 | 243 Latin | Duncan (1856 printing) | yes |
| Marcus Aurelius, *Meditations* | 412 | none (Greek not ingested) | Casaubon (1634) | yes |
| Seneca, *Epistulae Morales* | 124 | 124 Latin | Gummere (1917–25) | yes |
| Augustus, *Res Gestae* | 40 | 40 Latin | Bushnell (1998) | yes |
| Pliny the Younger, *Epistulae* | 219 | none | Melmoth, rev. Bosanquet | pending |
| Quintilian, *Institutio Oratoria* | 118 | 117 Latin | Butler (1920–22) | pending |
| Smith's *Dictionary* (reference) | 1,404 | none | 1875 edition | yes |
| Fowler, *Social Life at Rome* (reference) | 11 | none | 1908 | yes |

Roughly 3,439 passages scraped in total; 3,102 embedded into 8,231 chunks
(3,082 whole-passage chunks plus 5,149 finer paragraph chunks). Each passage
carries a canonical citation (`Att. 1.5`, `B.G. 1.1`, `Med. 4.23`, `R.G. 34`),
its translator and edition, and, for letters, the addressee.

The primary texts come from the Perseus Digital Library's
`canonical-latinLit` corpus; the Latin/English alignment for *ad Atticum* was
validated before it was built (414 of 446 Latin letters align, 92.8%).

## The personas

Six voices present the same retrieved material in different registers, all
composed from a persona-specific prompt plus a shared-rules block appended at
request time (grounding, citation discipline, quotation caps, the prohibition
on inventing texts, the separation of primary text from biographical
tradition, and brevity):

- **The Classicist** (default): a modern scholar reading across the whole
  archive; the one voice with reference-layer access.
- **Cicero**, **Caesar**, **Augustus**, **Seneca**, **Marcus Aurelius**:
  first-person figures, each scoped by retrieval to their own works and bound
  by prompt to their own lifetime. Caesar refuses the Philippics and his own
  assassination; Cicero will not narrate his own death; and so on.

Beyond the built-ins, a `persona_config` table and an admin editor allow
data-driven personas and per-persona overrides of prompt, temperature, voice,
and reference access without code changes. Per-persona sampling temperature
(0.7–0.8) is used as a register knob, which is why the generation model must
be a temperature-accepting Claude.

## Stack

| Layer | Component |
|---|---|
| Frontend | React Router 7 (SPA mode, Vite; SSR off) |
| 3D gallery | react-three-fiber over three.js; GSAP for interface motion |
| API | Supabase Edge Functions (Deno): `chat`, `search`, `speak`, `transcribe` |
| Database | Supabase Postgres + pgvector (HNSW, cosine) |
| Embeddings | OpenAI `text-embedding-3-small` (1,536-dim) |
| Generation | Anthropic Claude (Sonnet-class) via the Vercel AI SDK `streamText` |
| TTS / STT | ElevenLabs `eleven_flash_v2_5` (word timestamps) / OpenAI Whisper |
| Hosting | Vercel (static SPA) + Supabase (functions + DB) |
| Pipelines | Node 20 + TypeScript scrape / embed / topics CLI |

All conversational generation goes to Claude; OpenAI is used only for
embeddings and speech-to-text.

## Repository layout

pnpm workspace monorepo (Node ≥ 20, pnpm 9):

```
packages/shared        domain types (Story / Source / SearchResult)
packages/cli           scrape + embed + topics + eval + voice-profiles CLIs
supabase/migrations    schema + search_chunks RPC (.sql)
supabase/functions     chat + search + speak + transcribe Edge Functions (Deno)
web                    React Router 7 / Vite frontend (the @roman/web package)
docs                   the papers + deploy + admin + plan notes
data                   scrape output (data/stories.json; .cache is gitignored)
```

Web routes (`web/app/routes.ts`): `/` (the gallery), `/chat`, `/papers`,
`/papers/:slug`, `/admin`, plus the analytics routes `/library`, `/topics`,
`/graph`, `/heatmap`, `/glossary` (routable but unlinked until the thematic
tagging pass is run).

## Getting started

Prerequisites: Node ≥ 20, pnpm 9, and a Supabase project with pgvector. API
keys for OpenAI (embeddings), Anthropic (generation), and ElevenLabs (TTS).

```bash
pnpm install

# 1. Environment
cp .env.example .env          # fill in SUPABASE_* and the API keys
# frontend build-time vars live in web/.env.local:
#   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# 2. Run the frontend against the live backend
pnpm dev                      # http://localhost:5173

# 3. Typecheck / build
pnpm typecheck
pnpm build:web
```

`.env` holds the pipeline and server secrets (`SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`). `web/.env.local` holds the two
`VITE_` vars the browser needs. Both are gitignored. Under `pnpm dev` the auth
gate is bypassed, so the whole site is reachable locally.

## The data pipeline

The CLI (`packages/cli`) is a set of idempotent, source-keyed steps. Ingestion
diffs content against the database, so re-running only touches what changed.

```bash
pnpm scrape                        # all sources -> data/stories.json
pnpm scrape --source=letters-att   # a single source
pnpm embed                         # embed new/changed passages into `chunks`
pnpm topics                        # build the static library/analytics JSON
pnpm eval                          # retrieval eval fixture (Recall@k / MRR@k)
pnpm voice-profiles                # mine per-author voice references
pnpm test                          # unit tests (vitest)
```

`pnpm embed` needs `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY`. Scraping
needs no keys.

## Edge functions

The four Deno functions in `supabase/functions/` are deployed to Supabase, not
Vercel. They are self-contained (npm/jsr imports only).

```bash
supabase functions serve                                   # local
supabase functions deploy chat --project-ref <ref>         # deploy one
```

The `chat` function holds the persona prompts, the shared rules, retrieval,
author scoping, and the reference gate. `speak` returns audio plus word
timings; `transcribe` wraps Whisper; `search` is the bare retrieval endpoint.
Editing a persona prompt or a shared rule requires redeploying `chat`.

## Deployment

- **Frontend**: Vercel, from `vercel.json` at the repo root (`pnpm --filter
  @roman/web build` → `web/build/client`, static SPA with a fallback rewrite).
  Pushing to `main` triggers a production deploy.
- **Edge functions**: deployed separately via the Supabase CLI (above). They
  do not ride the Vercel deploy.
- **Database**: Supabase Postgres; migrations in `supabase/migrations/`.

See [`docs/deploy.md`](docs/deploy.md) for the full setup, including the
Supabase dashboard steps for auth.

## Authentication

The site is public (gallery, papers). `/chat` and `/admin` are gated: reaching
them requires a signed-in user, and `/admin` additionally requires
`profiles.is_admin = true`. Sign-in is magic link + Google and **invite-only**:
`signInWithOtp` passes `shouldCreateUser: false` and dashboard signups are
disabled, so a link is only ever issued to accounts created in the Supabase
dashboard. `AUTH_ENABLED` in `web/app/lib/config.ts` is the master switch;
`pnpm dev` bypasses the gate locally.

## Accessibility

The app targets WCAG AA. Notable measures: a global `prefers-reduced-motion`
implementation gating the intro sequence, GSAP staggers, the ring easing and
parallax, the custom cursor trail, and video autoplay; a `role="img"` text
alternative on the WebGL canvas naming the centred figure, with a live region
announcing figure changes; labelled inputs and numeral nav; a visible keyboard
focus ring across the gallery (whose native cursor is hidden); the loading
screen as a focus-managed dialog; and skip links on the content routes.

## Scripts

Root `package.json`:

| Script | Does |
|---|---|
| `pnpm dev` | run the frontend (`@roman/web`) |
| `pnpm build:web` | production SPA build |
| `pnpm typecheck` | typecheck every workspace package |
| `pnpm scrape` / `embed` / `topics` | the data pipeline (see above) |
| `pnpm eval` / `voice-profiles` / `test` | eval, voice mining, unit tests |
| `pnpm functions:serve` | run edge functions locally |
| `pnpm functions:deploy:chat` / `:search` | deploy an edge function |

## Documentation

The four long-form papers double as the project's design docs and are served
in-app under `/papers`:

- [`docs/roman-archive-interface.md`](docs/roman-archive-interface.md): the
  full system description (architecture, corpus, retrieval, personas, the
  gallery, evaluation, limitations).
- [`docs/reading-rome-in-translation.md`](docs/reading-rome-in-translation.md):
  the translators, what each rendering keeps and loses, and the manuscript
  transmission beneath the Latin.
- [`docs/giving-the-dead-a-voice.md`](docs/giving-the-dead-a-voice.md): the
  ethics of the personas, framed as digital *prosopopoeia*.
- [`docs/rag-for-a-classical-archive.md`](docs/rag-for-a-classical-archive.md):
  what retrieval can and cannot do for a corpus like this.

Operational notes: [`docs/deploy.md`](docs/deploy.md),
[`docs/admin-persona-editor.md`](docs/admin-persona-editor.md), and the
original plan/handover in
[`docs/cicero-archive-plan.md`](docs/cicero-archive-plan.md).

## Sourcing and licensing

The corpus is public-domain text. Primary Latin/English editions are drawn
from the Perseus canonical corpora and other public-domain digitisations; each
passage records its print edition. The Perseus TEI *markup* is CC BY-NC-SA,
but the underlying pre-1930 print editions are public domain, so the pipeline
ingests the text and records provenance. Modern in-copyright translations
(notably Shackleton Bailey's Cicero) are excluded; Bushnell's *Res Gestae*
(1998) is the one modern translation, distributed under a free licence.
Smith's *Dictionary* and Fowler are ingested as flagged reference only, never
voiced as testimony.

## Acknowledgements

Built on the architecture of the Bleek–Lloyd ǀxam archive, and on the Perseus
Digital Library, whose decades of work made the classical texts
computationally addressable in the first place.

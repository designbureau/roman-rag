# Cicero source modules

Each module fetches and parses one source group and returns `Story[]` to be
registered in `../index.ts`. The primary source is **Perseus
`canonical-latinLit`, author `phi0474` (Cicero)** — Latin (`perseus-lat1`/`lat2`)
and English (`perseus-eng1`/`opp-eng1`) TEI editions aligned by canonical
citation ref. See `docs/cicero-archive-plan.md` §4 for the validated alignment
approach and the production refinements (edition discovery from `__cts__.xml`,
case-normalised letter suffixes, stripping editorial headnotes, whole-letter vs
section granularity).

Planned modules:

- `perseus-tei.ts` — shared TEI walker (`work XML → Map<ref, {text, notes}>`)
- `work-registry.ts` — `phiNNN → {source, genre, abbrev, title, latEdition, engEdition|fallback}`
- `cicero-letters-att.ts`, `cicero-letters-fam.ts`, `cicero-letters-qfr.ts`, `cicero-letters-brut.ts`
- `cicero-orations.ts`, `cicero-philosophica.ts`, `cicero-rhetorica.ts`
- `english-fallback-gutenberg.ts`, `english-fallback-lacuscurtius.ts`

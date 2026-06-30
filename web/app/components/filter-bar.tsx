export type RetrievalFilters = {
  informant?: string;
  category?: string;
  source?: string;
};

/**
 * Static snapshots of the corpus facets — last refreshed 2026-05-06.
 *
 * The dropdown values must match the DB exactly so that filtering works.
 * If a future scrape changes how informant names are normalised, refresh
 * this list. To regenerate:
 *   select source, count(*) from stories group by source;
 *   select informant, count(*) from stories where informant is not null
 *     group by informant order by count(*) desc;
 *
 * Informants below the cutoff (~5 records) are intentionally omitted —
 * the long tail of DBLC contributor entries includes parser-error rows
 * with raw |xam phrases instead of names; surfacing those would clutter
 * the dropdown without adding useful filter granularity.
 */

const INFORMANTS = [
  { value: "ǀhanǂkass'o", label: "ǀhanǂkass'o" },
  { value: "Diaǃkwain", label: "Diaǃkwain" },
  { value: "ǁkabbo", label: "ǁkabbo" },
  { value: "ǀa!kunta", label: "ǀa!kunta" },
  { value: "ǂkasin", label: "ǂkasin" },
  { value: "ǃkweiten ta ǁken", label: "ǃkweiten ta ǁken" },
  { value: "ǂgerri-sse", label: "ǂgerri-sse" },
];

const SOURCES = [
  { value: "specimens-1911", label: "Specimens of Bushman Folklore (1911)" },
  { value: "mantis-friends-1924", label: "The Mantis & His Friends (1924)" },
  { value: "first-report-1873", label: "First Report (Bleek, 1873)" },
  { value: "second-report-1875", label: "Second Report (Bleek, 1875)" },
  { value: "third-report-1889", label: "Third Report (Lloyd, 1889)" },
  { value: "dblc-stories", label: "Digital Bleek & Lloyd notebooks" },
];

export function FilterBar({
  value,
  onChange,
}: {
  value: RetrievalFilters;
  onChange: (next: RetrievalFilters) => void;
}) {
  const update = (patch: Partial<RetrievalFilters>) => {
    const next = { ...value, ...patch };
    for (const k of Object.keys(next) as (keyof RetrievalFilters)[]) {
      if (next[k] === "" || next[k] === undefined) delete next[k];
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <label className="flex flex-1 items-center gap-2 sm:flex-none">
        <span className="text-[color:var(--muted-foreground)]">Informant</span>
        <select
          className="min-w-0 flex-1 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 sm:flex-none"
          value={value.informant ?? ""}
          onChange={(e) => update({ informant: e.target.value || undefined })}
        >
          <option value="">any</option>
          {INFORMANTS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-1 items-center gap-2 sm:flex-none">
        <span className="text-[color:var(--muted-foreground)]">Source</span>
        <select
          className="min-w-0 flex-1 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 sm:flex-none"
          value={value.source ?? ""}
          onChange={(e) => update({ source: e.target.value || undefined })}
        >
          <option value="">any</option>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

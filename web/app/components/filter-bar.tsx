export type RetrievalFilters = {
  informant?: string;
  category?: string;
  source?: string;
};

/**
 * Static snapshots of the corpus facets. The dropdown values must match
 * the DB exactly so that filtering works. To regenerate:
 *   select source, count(*) from stories group by source;
 *   select informant, count(*) from stories where informant is not null
 *     group by informant order by count(*) desc;
 *
 * `informant` holds the letter's ADDRESSEE (kept as the column name to
 * cut churn); `source` is the COLLECTION. The corpus is currently the
 * Letters to Atticus only — one addressee, one collection — so both lists
 * hold a single entry. They gain options automatically as the orations,
 * philosophica, and further letter collections are ingested.
 */

const ADDRESSEES = [
  { value: "Atticus", label: "Atticus" },
];

const COLLECTIONS = [
  { value: "letters-att", label: "Letters to Atticus (ad Atticum)" },
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
        <span className="text-[color:var(--muted-foreground)]">Addressee</span>
        <select
          className="min-w-0 flex-1 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 sm:flex-none"
          value={value.informant ?? ""}
          onChange={(e) => update({ informant: e.target.value || undefined })}
        >
          <option value="">any</option>
          {ADDRESSEES.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-1 items-center gap-2 sm:flex-none">
        <span className="text-[color:var(--muted-foreground)]">Collection</span>
        <select
          className="min-w-0 flex-1 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 sm:flex-none"
          value={value.source ?? ""}
          onChange={(e) => update({ source: e.target.value || undefined })}
        >
          <option value="">any</option>
          {COLLECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

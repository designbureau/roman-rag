/**
 * Persona tier toggle. Tiers are data-driven (authored in /admin, stored
 * in persona_config.age_tiers); the Storyteller's age tiers — Young
 * (≈5–8), Standard (≈9–12), Teen (13+) — are the canonical use, but any
 * persona can define its own set.
 *
 * Renders one button per tier the active persona defines. The selected
 * tier key is sent to the chat function as `tier`, which appends the
 * matching prompt addendum to the persona's system prompt. Hidden when a
 * persona has fewer than two tiers (nothing to choose).
 */
export type Tier = { key: string; label: string; hint?: string };

export function TierToggle({
  value,
  onChange,
  options,
  ariaLabel = "Tier",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Tier[];
  ariaLabel?: string;
}) {
  if (options.length < 2) return null;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.key)}
            title={opt.hint}
            className={
              "cursor-pointer rounded px-2.5 py-1 text-xs transition-colors " +
              (active
                ? "bg-[color:var(--background)] text-[color:var(--foreground)] font-medium"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

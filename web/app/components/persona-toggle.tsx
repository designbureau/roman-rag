import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

// Personas are data-driven (authored in /admin, stored in persona_config).
// The key is an open string; the toggle is rendered from the list passed in.
export type Persona = string;

export type PersonaOption = { key: Persona; title: string };

/**
 * Fallback persona list — the built-ins, in their canonical order. Used
 * before the persona_config fetch resolves, or if it fails. The source of
 * truth is the `persona_config` table (title + sort_order + enabled).
 */
export const FALLBACK_PERSONAS: PersonaOption[] = [
  { key: "archivist", title: "The Archivist" },
  { key: "mantis", title: "The Mantis" },
  { key: "lloyd", title: "Lucy Lloyd" },
  { key: "bleek", title: "Wilhelm Bleek" },
  { key: "interpreter", title: "The Interpreter" },
  { key: "storyteller", title: "The Storyteller" },
];

export function PersonaToggle({
  value,
  onChange,
  options,
  fullWidth = false,
}: {
  value: Persona;
  onChange: (p: Persona) => void;
  options: PersonaOption[];
  // When true, the toggle spans the full width of its container and the
  // tabs share the space evenly (used for the page-wide voices menu).
  fullWidth?: boolean;
}) {
  if (!options.length) return null;
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Persona)}>
      <TabsList className={fullWidth ? "flex w-full flex-wrap" : "flex flex-wrap"}>
        {options.map((o) => (
          <TabsTrigger
            key={o.key}
            value={o.key}
            className={
              fullWidth
                ? "flex-1 cursor-pointer whitespace-nowrap text-xs sm:text-sm"
                : "cursor-pointer whitespace-nowrap text-xs sm:text-sm"
            }
          >
            {o.title}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

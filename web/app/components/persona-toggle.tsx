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
// The Roman ensemble — the six code-backed voices, in canonical order.
// Mirrors PERSONA_PROMPTS in supabase/functions/chat/index.ts; persona_config
// (title + sort_order + enabled) is the live source of truth once it loads.
export const FALLBACK_PERSONAS: PersonaOption[] = [
  { key: "classicist", title: "The Classicist" },
  { key: "cicero", title: "Cicero" },
  { key: "caesar", title: "Caesar" },
  { key: "marcus-aurelius", title: "Marcus Aurelius" },
  { key: "augustus", title: "Augustus" },
  { key: "seneca", title: "Seneca" },
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
      <TabsList
        className={
          fullWidth ? "flex w-full flex-wrap justify-start" : "flex flex-wrap justify-start"
        }
      >
        {options.map((o) => (
          <TabsTrigger
            key={o.key}
            value={o.key}
            className="cursor-pointer whitespace-nowrap text-xs sm:text-sm"
          >
            {o.title}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

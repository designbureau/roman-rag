import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import ReactMarkdown from "react-markdown";
import type { Route } from "./+types/_index";
import {
  PersonaToggle,
  FALLBACK_PERSONAS,
  type Persona,
  type PersonaOption,
} from "~/components/persona-toggle";
import { FilterBar, type RetrievalFilters } from "~/components/filter-bar";
import { ChatPanel } from "~/components/chat-panel";
import { SiteNav } from "~/components/site-nav";
import { TierToggle, type Tier } from "~/components/storyteller-age";
import { useAuth } from "~/lib/auth";
import { AUTH_ENABLED } from "~/lib/config";
import { supabase } from "~/lib/supabase";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Bleek-Lloyd Archive" }];
}

const PERSONA_STORAGE_KEY = "bleek-lloyd-persona";
// Selected tier is remembered per persona (the Storyteller's age tier, and
// any other persona's tiers), keyed by `${prefix}${persona}`.
const TIER_STORAGE_PREFIX = "bleek-lloyd-tier:";
// Reserved persona_config row holding the editable shared rules — never a
// selectable persona.
const SHARED_RULES_KEY = "__shared__";

// Personas are open strings now (authored in /admin). A value is usable as
// a persona if it's a non-empty string other than the reserved key; the
// chat function validates it server-side and falls back to the Archivist.
function isPersona(v: unknown): v is Persona {
  return typeof v === "string" && v.length > 0 && v !== SHARED_RULES_KEY;
}

// A persona's tiers as stored in persona_config.age_tiers (admin-authored).
type LoadedTier = { key: string; label: string; hint: string; is_default: boolean };
function parseTiers(v: unknown): LoadedTier[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (t): t is Record<string, unknown> =>
        !!t && typeof t === "object" &&
        typeof (t as Record<string, unknown>).key === "string" &&
        typeof (t as Record<string, unknown>).label === "string",
    )
    .map((t) => ({
      key: t.key as string,
      label: t.label as string,
      hint: typeof t.hint === "string" ? (t.hint as string) : "",
      is_default: t.is_default === true,
    }));
}

function readStoredPersona(): Persona {
  if (typeof window === "undefined") return "archivist";
  const v = window.localStorage.getItem(PERSONA_STORAGE_KEY);
  return isPersona(v) ? v : "archivist";
}

function readStoredTier(persona: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TIER_STORAGE_PREFIX + persona) ?? "";
}
function writeStoredTier(persona: string, tier: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TIER_STORAGE_PREFIX + persona, tier);
  }
}

export default function Index() {
  const { user, signOut, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  // Persona list + display blurbs (admin-editable via /admin). Public read.
  // The toggle tabs and ordering come from persona_config.title/sort_order;
  // we start from the built-in fallback so the toggle renders immediately
  // and survives a failed/empty fetch.
  const [blurbs, setBlurbs] = useState<Record<string, string>>({});
  const [personaOptions, setPersonaOptions] =
    useState<PersonaOption[]>(FALLBACK_PERSONAS);
  // Per-persona tier selectors + each persona's default tier key, from
  // persona_config.age_tiers. Empty for personas without tiers.
  const [personaTiers, setPersonaTiers] = useState<Record<string, Tier[]>>({});
  const [defaultTier, setDefaultTier] = useState<Record<string, string>>({});
  const [showAbout, setShowAbout] = useState(false);
  useEffect(() => {
    supabase
      .from("persona_config")
      .select("persona, title, display_md, sort_order, enabled, age_tiers")
      .then(({ data, error }) => {
        if (error || !data) return; // keep the fallback list
        const rows = data as Array<{
          persona: string;
          title: string | null;
          display_md: string | null;
          sort_order: number | null;
          enabled: boolean | null;
          age_tiers: unknown;
        }>;
        const map: Record<string, string> = {};
        for (const r of rows) map[r.persona] = r.display_md ?? "";
        setBlurbs(map);
        const tiersMap: Record<string, Tier[]> = {};
        const defMap: Record<string, string> = {};
        for (const r of rows) {
          const tiers = parseTiers(r.age_tiers);
          if (tiers.length) {
            tiersMap[r.persona] = tiers.map((t) => ({ key: t.key, label: t.label, hint: t.hint }));
            defMap[r.persona] = (tiers.find((t) => t.is_default) ?? tiers[0]!).key;
          }
        }
        setPersonaTiers(tiersMap);
        setDefaultTier(defMap);
        const opts: PersonaOption[] = rows
          .filter((r) => r.enabled !== false && r.persona !== SHARED_RULES_KEY)
          .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100))
          .map((r) => ({ key: r.persona, title: (r.title ?? "").trim() || r.persona }));
        if (opts.length) setPersonaOptions(opts);
      });
  }, []);
  const personaParam = params.get("persona");
  // URL wins (so shared links land on the right voice); localStorage
  // remembers the last explicit pick across navigation and reloads.
  const persona: Persona = isPersona(personaParam)
    ? personaParam
    : readStoredPersona();
  const [filters, setFilters] = useState<RetrievalFilters>({});
  const currentTiers = personaTiers[persona] ?? [];
  const [tier, setTierState] = useState<string>("");
  // Normalise the selected tier whenever the persona (or its loaded tiers)
  // changes: prefer the remembered choice for this persona, else its default.
  useEffect(() => {
    const stored = readStoredTier(persona);
    const valid = currentTiers.some((t) => t.key === stored);
    setTierState(
      valid ? stored : (defaultTier[persona] ?? currentTiers[0]?.key ?? ""),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, personaTiers]);
  const setTier = (v: string) => {
    setTierState(v);
    writeStoredTier(persona, v);
  };

  // Mirror URL-derived persona into localStorage so subsequent
  // navigation (e.g. /library → /) keeps the same voice.
  useEffect(() => {
    if (isPersona(personaParam) && typeof window !== "undefined") {
      window.localStorage.setItem(PERSONA_STORAGE_KEY, personaParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaParam]);

  // ?ask=<term> is a one-shot seed for the chat input (used by the
  // topics page). Capture it on first render, then strip it from the
  // URL so a refresh doesn't re-seed.
  const askParam = params.get("ask");
  const [askSeed] = useState(() => askParam ?? "");
  useEffect(() => {
    if (askParam) {
      const next = new URLSearchParams(params);
      next.delete("ask");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPersona = (p: Persona) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PERSONA_STORAGE_KEY, p);
    }
    const next = new URLSearchParams(params);
    if (p === "archivist") next.delete("persona");
    else next.set("persona", p);
    setParams(next, { replace: true });
  };

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:py-12">
      <header className="mb-8 flex flex-col gap-5 lg:mb-10">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl">
            The Bleek-Lloyd Archive
          </h1>
          <p className="mt-3 max-w-xl text-sm text-[color:var(--muted-foreground)]">
            A reading interface for the public-domain |xam archive collected by
            Wilhelm Bleek and Lucy Lloyd. Multiple voices speak from the same
            notebooks.
          </p>
          {AUTH_ENABLED && user?.email && (
            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
              Signed in as{" "}
              <span className="font-mono">{user.email}</span>
              {" · "}
              <button
                type="button"
                onClick={() => void signOut()}
                className="underline hover:text-[color:var(--accent)]"
              >
                sign out
              </button>
            </p>
          )}
        </div>
      </header>

      <SiteNav isAdmin={isAdmin} />

      <div className="mb-8 flex flex-col items-stretch gap-2">
        <PersonaToggle
          value={persona}
          onChange={setPersona}
          options={personaOptions}
          fullWidth
        />
        {currentTiers.length >= 2 && (
          <div className="flex items-center gap-2">
            <TierToggle value={tier} onChange={setTier} options={currentTiers} />
          </div>
        )}
        {blurbs[persona]?.trim() && (
          <div>
            <button
              type="button"
              onClick={() => setShowAbout((s) => !s)}
              className="text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--accent)]"
            >
              {showAbout ? "Hide" : "About this voice"}
            </button>
            {showAbout && (
              <div className="prose-highlight mt-1 font-corpus text-sm leading-snug text-[color:var(--foreground)] [&_p]:my-1 [&_em]:italic">
                <ReactMarkdown>{blurbs[persona]}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-6">
        <FilterBar value={filters} onChange={setFilters} />
      </div>

      {/*
        Keying ChatPanel on persona AND tier means switching either
        remounts the chat — fresh conversation. Cleaner than threading a
        "clear on change" effect through the chat panel.
      */}
      <ChatPanel
        key={`${persona}:${tier}`}
        persona={persona}
        personaTitle={
          personaOptions.find((o) => o.key === persona)?.title ?? persona
        }
        retrievalFilters={filters}
        initialInput={askSeed}
        tier={tier}
      />

      <footer className="mt-16 border-t border-[color:var(--border)] pt-6 text-xs text-[color:var(--muted-foreground)]">
        Private experimental prototype. Sources:{" "}
        <a
          href="https://www.sacred-texts.com/afr/sbf/"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Specimens of Bushman Folklore (1911)
        </a>{" "}
        ·{" "}
        <a
          href="https://archive.org/details/bleek-mantis-friends-1924"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          The Mantis and His Friends (1924)
        </a>{" "}
        ·{" "}
        <a
          href="https://archive.org/details/briefaccountofbu00blee"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          A Brief Account of Bushman Folk-lore (Second Report, 1875)
        </a>{" "}
        ·{" "}
        <a
          href="https://cudl.lib.cam.ac.uk/view/PR-RCS-PAM-00005-E-REPORT/1"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Report of Dr. Bleek (First Report, 1873)
        </a>{" "}
        ·{" "}
        <a
          href="https://cudl.lib.cam.ac.uk/view/PR-RCS-PAM-00005-E-SHORT/1"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          A Short Account of Further Bushman Material (Third Report, Lloyd, 1889)
        </a>{" "}
        ·{" "}
        <a
          href="https://lloydbleekcollection.cs.uct.ac.za/"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          The Digital Bleek &amp; Lloyd
        </a>
        .
      </footer>
    </main>
  );
}

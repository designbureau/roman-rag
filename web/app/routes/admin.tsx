/**
 * Admin tab — author and edit the personas that drive the chat.
 *
 * Personas are data-driven: the list, titles, prompts, few-shot examples,
 * temperature, TTS voice, ordering, and enabled state all live in the
 * `persona_config` table and are edited here. Built-in personas keep their
 * finely-tuned prompts in code (a blank prompt override "tracks" the code
 * default); admin-authored personas carry their whole prompt in the row.
 *
 * The global SHARED_RULES block (applied to every voice) is editable too,
 * in its own section. NOTE: editing it CAN weaken the safety floor — the
 * code default is the seed and the "Reset to default" target.
 *
 * Access is gated on the signed-in user's `is_admin` profile flag. Writes
 * go through the authenticated Supabase client; RLS enforces admin-only
 * writes server-side, so the client gate is convenience, not the boundary.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { SiteNav } from "~/components/site-nav";
import { useAuth } from "~/lib/auth";
import { supabase } from "~/lib/supabase";
import { CHAT_FN_URL, SUPABASE_ANON_KEY, AUTH_ENABLED } from "~/lib/config";
import { MarkdownEditor } from "~/components/markdown-editor";

export function meta() {
  return [{ title: "Admin — The Roman Archive" }];
}

// Reserved row holding the editable global shared rules — not a persona.
const SHARED_RULES_KEY = "__shared__";
const KEY_RE = /^[a-z][a-z0-9]*$/;

type FewShot = { role: "user" | "assistant"; content: string };
// A persona tier (reader-selectable variants of a voice). A blank prompt
// tracks the code default for that key; an empty list means no tier selector.
type AgeTier = {
  key: string;
  label: string;
  hint: string;
  prompt: string;
  is_default: boolean;
};

function parseAgeTiers(v: unknown): AgeTier[] {
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
      prompt: typeof t.prompt === "string" ? (t.prompt as string) : "",
      is_default: t.is_default === true,
    }));
}

type Row = {
  persona: string;
  title: string;
  display_md: string;
  system_prompt_override: string | null;
  few_shots: FewShot[];
  temperature: number;
  voice_id: string | null;
  sort_order: number;
  enabled: boolean;
  is_builtin: boolean;
  age_tiers: AgeTier[];
  /** Whether this voice's retrieval also draws on the background/reference
   *  corpus (Smith's Dictionary, Fowler) — a per-persona setting. */
  include_reference: boolean;
};

function emptyRow(persona: string): Row {
  return {
    persona,
    title: "",
    display_md: "",
    system_prompt_override: null,
    few_shots: [],
    temperature: 0.7,
    voice_id: null,
    sort_order: 100,
    enabled: true,
    is_builtin: false,
    age_tiers: [],
    include_reference: false,
  };
}

function normaliseRow(r: Partial<Row> & { persona: string }): Row {
  const base = emptyRow(r.persona);
  return {
    ...base,
    ...r,
    title: r.title ?? "",
    display_md: r.display_md ?? "",
    few_shots: Array.isArray(r.few_shots) ? r.few_shots : [],
    temperature: typeof r.temperature === "number" ? r.temperature : 0.7,
    sort_order: typeof r.sort_order === "number" ? r.sort_order : 100,
    enabled: r.enabled ?? true,
    is_builtin: r.is_builtin ?? false,
    age_tiers: parseAgeTiers(r.age_tiers),
    include_reference: r.include_reference ?? false,
  };
}

const SELECT_COLS =
  "persona, title, display_md, system_prompt_override, few_shots, temperature, voice_id, sort_order, enabled, is_builtin, age_tiers, include_reference";

export default function Admin() {
  const { status, isAdmin, user } = useAuth();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loaded, setLoaded] = useState(false);
  // The built-in prompt body per persona (and the code SHARED_RULES under
  // the __shared__ key), fetched from the chat function's GET endpoint.
  // Used by the "Load default" actions so admins edit the real text.
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  // Built-in tier sets per persona (reader-selectable variants), from the
  // chat GET endpoint — used by the "Load built-in tiers" action.
  const [ageTierDefaults, setAgeTierDefaults] = useState<Record<string, AgeTier[]>>({});

  const reload = () => {
    supabase
      .from("persona_config")
      .select(SELECT_COLS)
      .then(({ data }) => {
        const map: Record<string, Row> = {};
        for (const r of (data ?? []) as Array<Partial<Row> & { persona: string }>) {
          map[r.persona] = normaliseRow(r);
        }
        if (!map[SHARED_RULES_KEY]) {
          map[SHARED_RULES_KEY] = {
            ...emptyRow(SHARED_RULES_KEY),
            title: "Shared rules (all voices)",
            is_builtin: true,
            enabled: false,
            sort_order: -1,
          };
        }
        setRows(map);
        setLoaded(true);
      });
  };

  useEffect(() => {
    // When the auth layer is disabled, the admin is open (private prototype);
    // otherwise it requires a signed-in admin.
    if (AUTH_ENABLED && (status !== "signed-in" || !isAdmin)) return;
    fetch(CHAT_FN_URL, {
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then((r) => (r.ok ? r.json() : { defaults: {}, ageTierDefaults: {} }))
      .then((j) => {
        setDefaults(j.defaults ?? {});
        setAgeTierDefaults(j.ageTierDefaults ?? {});
      })
      .catch(() => {
        setDefaults({});
        setAgeTierDefaults({});
      });
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin]);

  // Auth-gated only when the auth layer is enabled. With it disabled the
  // editor is open (the writes are still RLS-governed server-side).
  if (AUTH_ENABLED) {
    if (status === "loading") return <Centered>Loading…</Centered>;
    if (status !== "signed-in") return <Centered>Sign in to continue.</Centered>;
    if (!isAdmin) {
      return (
        <Centered>
          <p>This area is for administrators.</p>
          <Link to="/chat" className="mt-3 inline-block text-sm underline">
            ← back to chat
          </Link>
        </Centered>
      );
    }
  }

  const sharedRow = rows[SHARED_RULES_KEY];
  const personaRows = Object.values(rows)
    .filter((r) => r.persona !== SHARED_RULES_KEY)
    .sort((a, b) => a.sort_order - b.sort_order || a.persona.localeCompare(b.persona));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <header className="mb-6">
        <h1 className="font-display text-4xl">Persona editor</h1>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          {user?.email ? `Signed in as ${user.email}. ` : ""}Author the voices
          readers can pick — their title (the toggle tab), description, prompt,
          examples, voice, and order.
        </p>
      </header>

      <SiteNav isAdmin />

      {!loaded ? (
        <p className="text-sm text-[color:var(--muted-foreground)]">Loading personas…</p>
      ) : (
        <div className="space-y-8">
          {sharedRow && (
            <SharedRulesEditor
              row={sharedRow}
              defaultText={defaults[SHARED_RULES_KEY] ?? ""}
              userId={user?.id ?? null}
              onSaved={(next) => setRows((prev) => ({ ...prev, [SHARED_RULES_KEY]: next }))}
            />
          )}

          <NewPersonaForm
            existingKeys={Object.keys(rows)}
            userId={user?.id ?? null}
            onCreated={(row) => setRows((prev) => ({ ...prev, [row.persona]: row }))}
          />

          {personaRows.map((row) => (
            <PersonaEditor
              key={row.persona}
              row={row}
              defaultPrompt={defaults[row.persona] ?? ""}
              defaultTiers={ageTierDefaults[row.persona] ?? []}
              userId={user?.id ?? null}
              onSaved={(next) => setRows((prev) => ({ ...prev, [next.persona]: next }))}
              onDeleted={() =>
                setRows((prev) => {
                  const next = { ...prev };
                  delete next[row.persona];
                  return next;
                })
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}

// ── Shared rules editor ──────────────────────────────────────────────────
function SharedRulesEditor({
  row,
  defaultText,
  userId,
  onSaved,
}: {
  row: Row;
  defaultText: string;
  userId: string | null;
  onSaved: (next: Row) => void;
}) {
  const [text, setText] = useState(row.system_prompt_override ?? "");
  const [open, setOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Show the active rules: the saved override if any, else the code default.
  const didInit = useRef(row.system_prompt_override != null);
  useEffect(() => {
    if (didInit.current) return;
    if (defaultText) {
      setText(defaultText);
      didInit.current = true;
    }
  }, [defaultText]);

  const isDefault = !!defaultText && text.trim() === defaultText.trim();
  const effective = isDefault ? "" : text.trim() ? text : "";
  const dirty = effective !== (row.system_prompt_override ?? "");

  const save = async () => {
    setSaveState("saving");
    setError(null);
    const { error: err } = await supabase.from("persona_config").upsert(
      {
        persona: SHARED_RULES_KEY,
        system_prompt_override: effective || null,
        is_builtin: true,
        enabled: false,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "persona" },
    );
    if (err) {
      setSaveState("error");
      setError(err.message);
      return;
    }
    setSaveState("saved");
    onSaved({ ...row, system_prompt_override: effective || null });
    setTimeout(() => setSaveState("idle"), 2000);
  };

  return (
    <section className="rounded-md border-2 border-[color:var(--accent)] bg-[color:var(--accent)]/5 p-4">
      <h2 className="font-display text-2xl">Shared rules</h2>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
        Applied to <em>every</em> voice, on top of its own prompt — grounding
        in the corpus, no fabrication of letters or speeches, faithful
        citation, bounded knowledge, refusals.
      </p>
      <div className="mt-3 rounded-md border border-[color:var(--accent)] bg-[color:var(--background)] p-3 text-sm">
        <strong className="font-medium text-[color:var(--accent)]">Caution.</strong>{" "}
        These are the archive's safety floor. Editing them affects all
        personas at once and can weaken those protections. Use “Reset to
        default” to restore the built-in rules.
      </div>

      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="mt-3 text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
      >
        {open ? "Hide" : "Edit"} shared rules
      </button>
      {open && (
        <div className="mt-2">
          <MarkdownEditor value={text} onChange={setText} rows={16} placeholder="Loading the default rules…" />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saveState === "saving"}
              className="rounded-md border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-1.5 text-sm font-medium text-[color:var(--background)] transition-colors hover:bg-[color:var(--background)] hover:text-[color:var(--foreground)] disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setText(defaultText)}
              disabled={!defaultText || isDefault}
              className="text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-50"
            >
              Reset to default
            </button>
            {isDefault && (
              <span className="text-xs text-[color:var(--muted-foreground)]">
                Matches the built-in rules (saving keeps tracking the code default).
              </span>
            )}
            {saveState === "saved" && (
              <span className="text-xs text-[color:var(--muted-foreground)]">Saved — live on the next message.</span>
            )}
            {saveState === "error" && <span className="text-xs text-[color:var(--accent)]">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

// ── New persona ─────────────────────────────────────────────────────────
function NewPersonaForm({
  existingKeys,
  userId,
  onCreated,
}: {
  existingKeys: string[];
  userId: string | null;
  onCreated: (row: Row) => void;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const keyError =
    key && !KEY_RE.test(key)
      ? "Use lowercase letters/digits, starting with a letter (e.g. orator)."
      : existingKeys.includes(key)
        ? "That key is already taken."
        : key === SHARED_RULES_KEY
          ? "Reserved key."
          : null;
  const canSave = !!key && !keyError && !!title.trim() && !!prompt.trim() && saveState !== "saving";

  const reset = () => {
    setKey("");
    setTitle("");
    setPrompt("");
    setError(null);
  };

  const create = async () => {
    setSaveState("saving");
    setError(null);
    const row: Row = {
      ...emptyRow(key),
      title: title.trim(),
      system_prompt_override: prompt,
      sort_order: 100,
    };
    const { error: err } = await supabase.from("persona_config").insert({
      persona: row.persona,
      title: row.title,
      display_md: "",
      system_prompt_override: row.system_prompt_override,
      few_shots: row.few_shots,
      temperature: row.temperature,
      voice_id: row.voice_id,
      sort_order: row.sort_order,
      enabled: row.enabled,
      is_builtin: false,
      age_tiers: row.age_tiers,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });
    if (err) {
      setSaveState("error");
      setError(err.message);
      return;
    }
    setSaveState("idle");
    onCreated(row);
    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted-foreground)] hover:border-[color:var(--foreground)] hover:text-[color:var(--foreground)]"
      >
        + New persona
      </button>
    );
  }

  return (
    <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
      <h2 className="font-display text-2xl">New persona</h2>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
        A title and a prompt are enough to start. Examples, temperature, voice,
        and order can be tuned after it’s created. The shared safety rules are
        applied automatically.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Key (permanent)</Label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase())}
            placeholder="orator"
            className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 font-mono text-sm"
          />
          {keyError && <p className="mt-1 text-xs text-[color:var(--accent)]">{keyError}</p>}
        </div>
        <div>
          <Label>Title (toggle tab)</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The Orator"
            className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <Label className="mt-3 block">System prompt</Label>
      <div className="mt-1">
        <MarkdownEditor
          value={prompt}
          onChange={setPrompt}
          rows={12}
          placeholder="Identity, voice, what it knows, how it refuses…"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={create}
          disabled={!canSave}
          className="rounded-md border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-1.5 text-sm font-medium text-[color:var(--background)] transition-colors hover:bg-[color:var(--background)] hover:text-[color:var(--foreground)] disabled:opacity-50"
        >
          {saveState === "saving" ? "Creating…" : "Create persona"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
        >
          Cancel
        </button>
        {saveState === "error" && <span className="text-xs text-[color:var(--accent)]">{error}</span>}
      </div>
    </section>
  );
}

// ── Per-persona editor ────────────────────────────────────────────────────
function PersonaEditor({
  row,
  defaultPrompt,
  defaultTiers,
  userId,
  onSaved,
  onDeleted,
}: {
  row: Row;
  defaultPrompt: string;
  defaultTiers: AgeTier[];
  userId: string | null;
  onSaved: (next: Row) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(row.title);
  const [displayMd, setDisplayMd] = useState(row.display_md);
  const [prompt, setPrompt] = useState(row.system_prompt_override ?? "");
  const [fewShots, setFewShots] = useState<FewShot[]>(row.few_shots);
  const [ageTiers, setAgeTiers] = useState<AgeTier[]>(row.age_tiers);
  const [temperature, setTemperature] = useState(row.temperature);
  const [voiceId, setVoiceId] = useState(row.voice_id ?? "");
  const [sortOrder, setSortOrder] = useState(row.sort_order);
  const [enabled, setEnabled] = useState(row.enabled);
  const [includeReference, setIncludeReference] = useState(row.include_reference);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // For built-ins, auto-load the code prompt when there's no override, so
  // the editor shows the real instructions rather than a blank box.
  const didInit = useRef(row.system_prompt_override != null || !row.is_builtin);
  useEffect(() => {
    if (didInit.current) return;
    if (defaultPrompt) {
      setPrompt(defaultPrompt);
      didInit.current = true;
    }
  }, [defaultPrompt]);

  // A built-in whose prompt matches the code default is stored as null so it
  // keeps tracking the code prompt. New personas always store their prompt.
  const isDefaultPrompt = row.is_builtin && !!defaultPrompt && prompt.trim() === defaultPrompt.trim();
  const effectivePrompt = isDefaultPrompt ? null : prompt.trim() ? prompt : row.is_builtin ? null : "";

  const save = async () => {
    setSaveState("saving");
    setError(null);
    const payload = {
      persona: row.persona,
      title: title.trim(),
      display_md: displayMd,
      system_prompt_override: effectivePrompt,
      few_shots: fewShots.filter((f) => f.content.trim()),
      age_tiers: cleanTiers(ageTiers),
      temperature,
      voice_id: voiceId.trim() || null,
      sort_order: sortOrder,
      enabled,
      include_reference: includeReference,
      is_builtin: row.is_builtin,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };
    const { error: err } = await supabase
      .from("persona_config")
      .upsert(payload, { onConflict: "persona" });
    if (err) {
      setSaveState("error");
      setError(err.message);
      return;
    }
    setSaveState("saved");
    onSaved({
      ...row,
      title: payload.title,
      display_md: payload.display_md,
      system_prompt_override: payload.system_prompt_override,
      few_shots: payload.few_shots,
      age_tiers: payload.age_tiers,
      temperature,
      voice_id: payload.voice_id,
      sort_order: sortOrder,
      enabled,
      include_reference: includeReference,
    });
    setTimeout(() => setSaveState("idle"), 2000);
  };

  const remove = async () => {
    if (!confirm(`Delete the “${row.title || row.persona}” persona? This cannot be undone.`)) return;
    const { error: err } = await supabase.from("persona_config").delete().eq("persona", row.persona);
    if (err) {
      setSaveState("error");
      setError(err.message);
      return;
    }
    onDeleted();
  };

  return (
    <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">
          {title || row.persona}
          {!enabled && (
            <span className="ml-2 align-middle text-xs font-normal text-[color:var(--muted-foreground)]">
              (hidden)
            </span>
          )}
        </h2>
        <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
          {row.persona}
          {row.is_builtin ? " · built-in" : ""}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Title (toggle tab)</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Show in the chat toggle
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={includeReference}
            onChange={(e) => setIncludeReference(e.target.checked)}
            className="h-4 w-4"
          />
          <span>
            Roman context
            <span className="ml-1.5 text-xs font-normal text-[color:var(--muted-foreground)]">
              — draw on background reference (Smith's Dictionary, Fowler) about the Roman world
            </span>
          </span>
        </label>
      </div>

      <Label className="mt-3 block">Description (shown to readers)</Label>
      <div className="mt-1">
        <MarkdownEditor value={displayMd} onChange={setDisplayMd} rows={4} placeholder="A short description of this voice…" />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="mt-3 text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
      >
        {showAdvanced ? "Hide" : "Show"} advanced: prompt, examples, voice
      </button>

      {showAdvanced && (
        <div className="mt-2 space-y-4">
          <div>
            <Label>System prompt</Label>
            <p className="mb-1 text-xs text-[color:var(--muted-foreground)]">
              The instructions that define this voice. The shared safety rules
              are appended automatically.{" "}
              {row.is_builtin && "Clearing this reverts to the built-in prompt."}
            </p>
            <MarkdownEditor value={prompt} onChange={setPrompt} rows={16} placeholder="Loading…" />
            {isDefaultPrompt && (
              <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                Unchanged from the built-in prompt — edit to customise.
              </p>
            )}
          </div>

          <FewShotEditor value={fewShots} onChange={setFewShots} isBuiltin={row.is_builtin} />

          <TierEditor value={ageTiers} onChange={setAgeTiers} defaults={defaultTiers} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Temperature</Label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label>Sort order</Label>
              <input
                type="number"
                step={1}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label>ElevenLabs voice ID</Label>
              <input
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                placeholder="(default)"
                className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saveState === "saving"}
          className="rounded-md border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-1.5 text-sm font-medium text-[color:var(--background)] transition-colors hover:bg-[color:var(--background)] hover:text-[color:var(--foreground)] disabled:opacity-50"
        >
          {saveState === "saving" ? "Saving…" : "Save"}
        </button>
        {!row.is_builtin && (
          <button
            type="button"
            onClick={remove}
            className="text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--accent)]"
          >
            Delete
          </button>
        )}
        {saveState === "saved" && (
          <span className="text-xs text-[color:var(--muted-foreground)]">
            Saved — live on the next message.{" "}
            <Link to={`/?persona=${row.persona}`} className="underline hover:text-[color:var(--foreground)]">
              Try in chat →
            </Link>
          </span>
        )}
        {saveState === "error" && <span className="text-xs text-[color:var(--accent)]">{error}</span>}
      </div>
    </section>
  );
}

// ── Few-shot examples editor ──────────────────────────────────────────────
function FewShotEditor({
  value,
  onChange,
  isBuiltin,
}: {
  value: FewShot[];
  onChange: (next: FewShot[]) => void;
  isBuiltin: boolean;
}) {
  const update = (i: number, patch: Partial<FewShot>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => {
    // Alternate the role so a fresh pair reads user → assistant.
    const role: FewShot["role"] =
      value.length && value[value.length - 1]!.role === "user" ? "assistant" : "user";
    onChange([...value, { role, content: "" }]);
  };

  return (
    <div>
      <Label>Few-shot examples</Label>
      <p className="mb-1 text-xs text-[color:var(--muted-foreground)]">
        Sample turns that shape the voice before the real conversation.{" "}
        {isBuiltin
          ? "Leave empty to use the built-in examples."
          : "Optional, but a few good ones sharpen a new voice."}
      </p>
      <div className="space-y-2">
        {value.map((f, i) => (
          <div key={i} className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-2">
            <div className="mb-1 flex items-center justify-between">
              <select
                value={f.role}
                onChange={(e) => update(i, { role: e.target.value as FewShot["role"] })}
                className="rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs"
              >
                <option value="user">user</option>
                <option value="assistant">assistant</option>
              </select>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--accent)]"
              >
                remove
              </button>
            </div>
            <textarea
              value={f.content}
              onChange={(e) => update(i, { content: e.target.value })}
              rows={f.role === "assistant" ? 4 : 2}
              className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1.5 text-sm"
              placeholder={f.role === "user" ? "A reader's question…" : "How this voice answers it…"}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
      >
        + add example turn
      </button>
    </div>
  );
}

// ── Persona tier editor (reader-selectable variants) ──────────────────────
// Drop incomplete tiers and guarantee exactly one default when any exist.
function cleanTiers(tiers: AgeTier[]): AgeTier[] {
  const cleaned = tiers
    .map((t) => ({
      ...t,
      key: t.key.trim(),
      label: t.label.trim(),
      hint: t.hint.trim(),
    }))
    .filter((t) => t.key && t.label);
  if (cleaned.length && !cleaned.some((t) => t.is_default)) {
    cleaned[0]!.is_default = true;
  }
  return cleaned;
}

function TierEditor({
  value,
  onChange,
  defaults,
}: {
  value: AgeTier[];
  onChange: (next: AgeTier[]) => void;
  defaults: AgeTier[];
}) {
  const gid = useId();
  const update = (i: number, patch: Partial<AgeTier>) =>
    onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const setDefault = (i: number) =>
    onChange(value.map((t, idx) => ({ ...t, is_default: idx === i })));
  const add = () =>
    onChange([
      ...value,
      { key: "", label: "", hint: "", prompt: "", is_default: value.length === 0 },
    ]);

  const cell =
    "rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] px-2 py-1.5 text-sm";

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>Tiers (reader-selectable variants)</Label>
        {defaults.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(defaults.map((t) => ({ ...t })))}
            className="text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            Load built-in tiers
          </button>
        )}
      </div>
      <p className="mb-1 text-xs text-[color:var(--muted-foreground)]">
        Optional. A toggle the reader picks (for example, a plainer or a more
        scholarly register of the same voice); the selected tier's text is
        appended to the prompt. Leave a tier's prompt blank to track the
        built-in default. Two or more tiers are needed for the toggle to appear.
      </p>
      <div className="space-y-2">
        {value.map((t, i) => (
          <div
            key={i}
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-2"
          >
            <div className="mb-2 grid gap-2 sm:grid-cols-3">
              <input
                value={t.key}
                onChange={(e) => update(i, { key: e.target.value })}
                placeholder="key (e.g. young)"
                className={`${cell} font-mono text-xs`}
              />
              <input
                value={t.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label (e.g. Young)"
                className={cell}
              />
              <input
                value={t.hint}
                onChange={(e) => update(i, { hint: e.target.value })}
                placeholder="Hint (e.g. ≈ 5–8 years)"
                className={cell}
              />
            </div>
            <textarea
              value={t.prompt}
              onChange={(e) => update(i, { prompt: e.target.value })}
              rows={4}
              placeholder="Prompt addendum — leave blank to use the built-in default for this key"
              className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] px-2 py-1.5 text-sm"
            />
            <div className="mt-1 flex items-center gap-4 text-xs text-[color:var(--muted-foreground)]">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name={`tier-default-${gid}`}
                  checked={t.is_default}
                  onChange={() => setDefault(i)}
                />
                default
              </label>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="underline hover:text-[color:var(--foreground)] disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="underline hover:text-[color:var(--foreground)] disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="underline hover:text-[color:var(--accent)]"
              >
                remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 text-xs underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
      >
        + add tier
      </button>
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-xs font-medium text-[color:var(--muted-foreground)] ${className}`}>
      {children}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center text-sm text-[color:var(--muted-foreground)]">
      {children}
    </main>
  );
}

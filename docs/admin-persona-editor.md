# Admin persona editor

Personas are **data-driven**. The `/admin` tab is where they are authored
and edited; the `persona_config` table is the source of truth for the
persona list and its metadata. Built-in voices keep their finely-tuned
prompts in code; admin-authored voices live entirely in the table.

## What an admin can edit

Per persona:

1. **Title** — the display name; it populates the chat toggle tabs and the
   "Ask … something" prompts.
2. **Description** — a reader-facing blurb under the toggle ("About this
   voice"). Purely presentational.
3. **System prompt** (advanced) — the instructions that define the voice.
   For a built-in, a blank prompt "tracks" the code default; a "Load
   built-in prompt" affordance fills the editor with the real default, and
   clearing it reverts. For an admin-authored persona, the prompt lives in
   the row.
4. **Few-shot examples** (advanced) — sample user/assistant turns that
   shape the voice. Empty on a built-in means its code examples are used.
5. **Temperature**, **ElevenLabs voice ID**, **sort order**, and an
   **enabled** toggle (advanced). Disabling hides the voice from the chat
   toggle and makes the chat function fall back to the Archivist if it is
   requested directly.

Admins can also **create** new personas (a slug key, a title, a prompt) and
**delete** any non-built-in persona.

## Shared rules (editable)

The global `SHARED_RULES` block — language-group discrimination, no
fabrication, rock-art attribution, factual biographies, recitation mode,
refusals — is appended to **every** persona at request time. It is editable
in its own `/admin` section, stored in the reserved `persona_config` row
`persona = '__shared__'`.

> **Caution.** This is the archive's safety floor, applied to all voices at
> once. Editing it can weaken those protections. The code `SHARED_RULES`
> remain the seed and the "Reset to default" target: a blank override means
> the code default is used, so the floor still exists before the row is ever
> touched.

## Prompt assembly (chat function)

```
system = personaBody                 // code default (built-in) or the row's override
       + "\n\n" + sharedRules        // row '__shared__' override, else code SHARED_RULES
       + (storyteller ? age-tier block : "")
       + "\n\n---\n\nRETRIEVED PASSAGES:\n\n" + context
fewShots = row.few_shots (if any) else code few-shots
temperature = row.temperature (else code, else 0.7)
```

A requested persona that is unknown, unresolvable, or disabled falls back to
the Archivist so the request always succeeds.

## Data model

- `profiles` (one row per `auth.users` id, `is_admin boolean`).
  Auto-created on signup; the admin flag is set manually in SQL.
- `persona_config`:
  - `persona` (PK; slug `^[a-z][a-z0-9]*$`, or the reserved `__shared__`)
  - `title`, `display_md`, `system_prompt_override`
  - `few_shots` (jsonb `[{role, content}]`), `temperature`
  - `voice_id`, `voice_settings` (jsonb) — ElevenLabs voice for `/speak`
  - `sort_order`, `enabled`, `is_builtin`
  - `updated_at`, `updated_by`

  Created/reconciled by `supabase/migrations/20260618000000_dynamic_personas.sql`,
  which also seeds the six built-ins, the `__shared__` row, and the first
  fully data-driven persona, **The Early Race**.

## Access control (RLS)

- `profiles`: a user can read only their own row.
- `persona_config`: public read (the home page and the chat/speak functions
  read it); writes (insert/update/delete) allowed only when the caller's
  profile has `is_admin = true`. The chat/speak Edge Functions read with the
  service-role key, so they bypass RLS and see disabled rows.

The client-side `/admin` gate (on `useAuth().isAdmin`) is convenience — the
security boundary is the RLS write policy.

## When edits take effect

`chat/index.ts` reads the persona config and shared rules fresh on every
turn (indexed PK lookups via the service-role client). The toggle and
voice are read by the frontend / `speak`. A Save therefore applies on the
next message; returning to the chat route re-fetches the toggle and blurbs.

## Granting admin

```sql
update profiles set is_admin = true where email = 'someone@example.com';
```

The user must have signed in at least once (so their `profiles` row exists).

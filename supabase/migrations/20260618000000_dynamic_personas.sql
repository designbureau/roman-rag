-- Data-driven personas.
--
-- Until now the set of personas was hardcoded across the codebase and the
-- `persona_config` table (created out-of-band, never in a migration) only
-- carried a per-persona display blurb and an optional system-prompt
-- override. This migration makes personas authorable from the /admin UI:
-- the table becomes the source of truth for the persona LIST and its
-- metadata (label, few-shots, temperature, TTS voice, ordering, enabled
-- state), while the five Roman built-ins keep their finely-tuned prompts in
-- code (a null override means "track the code prompt"). New personas are
-- pure data — their row carries the whole prompt.
--
-- It also makes the global SHARED_RULES editable: a reserved row
-- (`persona`='__shared__') holds an override of the safety/voice rules
-- block that the chat function appends to every persona. A null override
-- means the code SHARED_RULES are used. NOTE: this intentionally allows an
-- admin to weaken the safety floor; the code default remains as the
-- reset/seed. This is a private experiment, not a public release.

-- ── Table (reconcile; it exists in prod but had no migration) ──────────
create table if not exists persona_config (
  persona                 text primary key,
  display_md              text not null default '',
  system_prompt_override  text,
  updated_at              timestamptz not null default now(),
  updated_by              uuid
);

-- New metadata columns. ADD COLUMN IF NOT EXISTS so prod data survives.
-- `title` is the persona's display name; it populates the chat toggle tabs.
alter table persona_config add column if not exists title          text   not null default '';
alter table persona_config add column if not exists few_shots      jsonb  not null default '[]'::jsonb;
alter table persona_config add column if not exists temperature    real   not null default 0.7;
alter table persona_config add column if not exists voice_id       text;
alter table persona_config add column if not exists voice_settings jsonb;
alter table persona_config add column if not exists sort_order     int    not null default 100;
alter table persona_config add column if not exists enabled        boolean not null default true;
alter table persona_config add column if not exists is_builtin     boolean not null default false;

-- ── Row-level security ─────────────────────────────────────────────────
-- Public SELECT (home page + chat/speak functions read it); writes only
-- for callers whose profile has is_admin. Policies are managed by name so
-- this is idempotent and leaves any pre-existing equivalents untouched.
alter table persona_config enable row level security;

drop policy if exists persona_config_public_read on persona_config;
create policy persona_config_public_read on persona_config
  for select to anon, authenticated using (true);

drop policy if exists persona_config_admin_write on persona_config;
create policy persona_config_admin_write on persona_config
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

create index if not exists persona_config_enabled_sort_idx
  on persona_config (enabled, sort_order);

-- ── Seed: built-in personas (the Roman ensemble) ───────────────────────
-- Set list metadata on the code-backed voices. We deliberately do NOT touch
-- system_prompt_override / few_shots / voice_* on conflict, so any existing
-- admin edits and the code-tracked prompts are preserved. `enabled` is left
-- to its default / existing value. Titles + sort_order mirror FALLBACK_PERSONAS
-- in web/app/components/persona-toggle.tsx and PERSONA_PROMPTS in
-- supabase/functions/chat/index.ts.
insert into persona_config (persona, title, temperature, sort_order, is_builtin) values
  ('classicist',      'The Classicist', 0.7,  0, true),
  ('cicero',          'Cicero',         0.75, 1, true),
  ('tiro',            'Tiro',           0.7,  2, true),
  ('atticus',         'Atticus',        0.75, 3, true),
  ('caesar',          'Caesar',         0.7,  4, true),
  ('marcus-aurelius', 'Marcus Aurelius',0.75, 5, true),
  ('augustus',        'Augustus',       0.7,  6, true),
  ('seneca',          'Seneca',         0.8,  7, true),
  ('pliny-younger',   'Pliny the Younger', 0.75, 8, true),
  ('quintilian',      'Quintilian',     0.7,  9, true)
on conflict (persona) do update set
  title      = excluded.title,
  temperature= excluded.temperature,
  sort_order = excluded.sort_order,
  is_builtin = true;

-- ── Seed: editable shared rules ────────────────────────────────────────
-- Reserved, non-persona row. enabled=false so it never appears in the
-- toggle and the chat resolver rejects it as a persona. A null override
-- means the code SHARED_RULES are used; the /admin "Load default" button
-- pulls the code text (via the chat GET endpoint) for editing.
insert into persona_config (persona, title, sort_order, is_builtin, enabled)
values ('__shared__', 'Shared rules (all voices)', -1, true, false)
on conflict (persona) do nothing;

-- No admin-authored seed persona ships with the Cicero corpus. The seven
-- built-ins above carry their prompts in code (null override = track code);
-- the first fully data-driven Roman voice (e.g. a Phase-2 sallust/livy/
-- biographer) will be authored in /admin once its own texts are ingested.

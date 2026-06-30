-- Data-driven persona "tiers" (a.k.a. the Storyteller age tiers).
--
-- The Storyteller had three hardcoded age-tier addenda in the chat Edge
-- Function (young / standard / teen), selected by a `storytellerAge`
-- request param and appended to the system prompt. This makes the whole
-- tier set authorable from /admin, for ANY persona: the row carries an
-- ordered list of tiers, each with a key, a display label, a hint (e.g.
-- an age range), an optional prompt addendum, and a default flag.
--
-- A tier with a blank `prompt` tracks the code default for that key
-- (exactly like a null system_prompt_override) — so the chat function
-- falls back to its built-in STORYTELLER_AGE_TIERS block. This keeps the
-- migration light (no need to copy the long tier prose into SQL) while
-- still letting an admin override any tier's wording, rename tiers, add
-- new ones, or remove them. An empty array means the persona has no
-- tier selector at all.

alter table persona_config
  add column if not exists age_tiers jsonb not null default '[]'::jsonb;

-- Seed the Storyteller with its three built-in tiers (blank prompts =
-- track the code defaults). Only when it hasn't already been authored,
-- so a re-run never clobbers later admin edits.
update persona_config
set age_tiers = $tiers$[
  {"key":"young","label":"Young","hint":"≈ 5–8 years","prompt":"","is_default":false},
  {"key":"standard","label":"Standard","hint":"≈ 9–12 years","prompt":"","is_default":true},
  {"key":"teen","label":"Teen","hint":"13+","prompt":"","is_default":false}
]$tiers$::jsonb
where persona = 'storyteller'
  and (age_tiers is null or age_tiers = '[]'::jsonb);

-- Move the "Roman context" toggle from a per-message chat option to a
-- per-persona setting, authored in /admin like temperature or voice_id.
--
-- Rationale: whether a voice draws on background reference material (Smith's
-- Dictionary, Fowler) is a property of that voice, not something a reader
-- should have to remember to flip on each message. The Classicist — the one
-- voice that reads across the whole archive — is seeded on; the bounded
-- first-person figures default off, so they stay in their own words unless
-- an admin deliberately opts one in.

alter table persona_config
  add column if not exists include_reference boolean not null default false;

update persona_config set include_reference = true where persona = 'classicist';

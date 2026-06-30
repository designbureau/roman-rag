-- Lock down the corpus tables.
--
-- stories, chunks, and images had row-level security disabled, so the
-- public anon key could read AND write every row. The browser never
-- queries these tables directly (it only uses persona_config and
-- profiles, both already RLS-protected); all reads happen server-side in
-- the edge functions via the service-role key, which bypasses RLS.
--
-- Enabling RLS with no policies therefore denies the anon and
-- authenticated roles entirely while leaving the edge-function retrieval
-- path (service-role) untouched. The "RLS enabled, no policy" linter
-- notice is the intended deny-all state for these service-only tables.

alter table public.stories enable row level security;
alter table public.chunks  enable row level security;
alter table public.images  enable row level security;

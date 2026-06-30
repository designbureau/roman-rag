-- Language-group discrimination (Skotnes feedback, problem 1).
--
-- The corpus mixes |xam (central Karoo) with !kun (northern Namibia /
-- Angola), Khoekhoe, and Dorothea Bleek's later multi-group notebook
-- material. Retrieval previously could not tell them apart, so the !kun
-- ǀXue cycle surfaced as |xam. This migration adds a `language` column,
-- classifies every story, and teaches search_chunks to filter on it.
--
-- Values: 'xam' | 'kun' | 'khoekhoe' | 'other' | 'unknown'.
--   xam      — the central Karoo |xam corpus (the seven canonical
--              informants + the |xam print sources)
--   kun      — the !kun ǀXue cycle and known !kun informants
--   khoekhoe — Jemima Bleek's "Hottentot" (Khoekhoe) interviews
--   other    — Dorothea/Jemima notebook material from groups we cannot
--              yet attribute cleanly (Naron, Langeberg, !kung, central)
--   unknown  — unattributed; deliberately NOT defaulted to xam so it
--              cannot pollute |xam retrieval (flagged for a later pass)

alter table stories add column if not exists language text not null default 'unknown';

-- Order matters: later statements override earlier ones.

-- |xam print sources (Specimens, the three Reports, Mantis & Friends).
update stories set language = 'xam'
where source in ('specimens-1911','first-report-1873','second-report-1875',
                 'third-report-1889','mantis-friends-1924');

-- |xam by canonical informant (covers the DBLC notebook stories).
update stories set language = 'xam'
where informant in (
  'ǀhanǂkass''o','Diaǃkwain','ǁkabbo','ǀa!kunta','ǂkasin',
  'ǃkweiten ta ǁken','ǂgerri-sse','possibly Dia!kwain'
);

-- !kun: the ǀXue cycle (Skotnes: "ǀxue is exclusively a !kun figure")
-- and the known !kun informants. The ǀXue cycle in Specimens Part II is
-- a numbered run; "2. Further Changes Of Form" continues it but has no
-- "xue" in the title, so it is caught by id.
update stories set language = 'kun'
where title ilike '%xue%'
   or id = 'specimens-1911__2-further-changes-of-form'
   or informant in ('!nanni','ǀnanni','Tamme','ǀuma','Da');

-- Khoekhoe: Jemima Bleek's "Hottentot" interviews.
update stories set language = 'khoekhoe'
where title ilike '%hottentot%' or informant = 'Griet; Cela; Piet Lynx';

-- Dorothea's (and Jemima's) mixed later notebooks that aren't already
-- classified above: honest 'other', not |xam.
update stories set language = 'other'
where language = 'unknown'
  and (id like 'dblc-stories__dorothea-%' or id like 'dblc-stories__jemima-%');

create index if not exists stories_language_idx on stories (language);

-- Recreate search_chunks with a language filter. Default is NULL, which
-- the chat function passes as 'xam' to keep retrieval |xam-only unless
-- another group is explicitly requested.
drop function if exists search_chunks(vector, int, text, text, text, boolean);

create function search_chunks(
  query_embedding   vector(1536),
  match_count       int default 10,
  filter_informant  text default null,
  filter_category   text default null,
  filter_source     text default null,
  filter_mantis     boolean default null,
  filter_language   text default null
)
returns table (
  chunk_id         uuid,
  story_id         text,
  story_title      text,
  source           text,
  informant        text,
  category         text,
  mantis_cycle     boolean,
  chunk_type       text,
  content          text,
  source_url       text,
  latin_text         text,
  cicero_ref  text,
  language         text,
  similarity       float
)
language sql stable as $$
  select
    c.id,
    s.id,
    s.title,
    s.source,
    s.informant,
    s.category,
    s.mantis_cycle,
    c.chunk_type,
    c.content,
    s.source_url,
    s.latin_text,
    s.cicero_ref,
    s.language,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join stories s on s.id = c.story_id
  where (filter_informant is null or s.informant = filter_informant)
    and (filter_category  is null or s.category  = filter_category)
    and (filter_source    is null or s.source    = filter_source)
    and (filter_mantis    is null or s.mantis_cycle = filter_mantis)
    and (filter_language  is null or s.language  = filter_language)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

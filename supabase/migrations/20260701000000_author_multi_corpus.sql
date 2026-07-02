-- Multi-author corpus: the archive grows beyond Cicero.
--
-- The corpus was implicitly single-author (Cicero). As we add other Romans
-- (Marcus Aurelius' Meditations first, then Augustus, etc.), retrieval must
-- be able to scope to a single author's own writings so a bounded first-
-- person voice never reasons over a text it could not have known. The
-- Classicist (and any unscoped caller) still ranges across the whole archive.
--
-- `author` defaults to 'Cicero' so the 460 existing rows are classified
-- correctly without a data backfill.

alter table stories add column if not exists author text not null default 'Cicero';
create index if not exists stories_author_idx on stories (author);

-- Recreate search_chunks with an optional author filter and an `author`
-- return column. A DROP is required because the RETURNS TABLE shape changes.
-- The trailing param has a default, and the previously-deployed chat function
-- calls by named args, so it keeps working until the new function is deployed.
drop function if exists search_chunks(vector, int, text, text, text, boolean);

create function search_chunks(
  query_embedding   vector(1536),
  match_count       int default 10,
  filter_informant  text default null,
  filter_category   text default null,
  filter_source     text default null,
  filter_mantis     boolean default null,
  filter_author     text default null
)
returns table (
  chunk_id     uuid,
  story_id     text,
  story_title  text,
  source       text,
  informant    text,
  category     text,
  mantis_cycle boolean,
  chunk_type   text,
  content      text,
  source_url   text,
  latin_text   text,
  cicero_ref   text,
  author       text,
  similarity   float
)
language sql stable
set search_path to 'public'
as $$
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
    s.author,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join stories s on s.id = c.story_id
  where (filter_informant is null or s.informant = filter_informant)
    and (filter_category  is null or s.category  = filter_category)
    and (filter_source    is null or s.source    = filter_source)
    and (filter_mantis    is null or s.mantis_cycle = filter_mantis)
    and (filter_author    is null or s.author    = filter_author)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

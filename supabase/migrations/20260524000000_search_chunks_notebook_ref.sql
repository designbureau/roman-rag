-- Add `cicero_ref` to the search_chunks return shape so the
-- frontend can surface a "notebook page" card alongside retrieved
-- passages. The field is already on the `stories` table — this
-- migration just exposes it through the RPC.
--
-- Drop-then-create instead of `create or replace` because PostgreSQL
-- rejects RETURNS-TABLE shape changes on a replace.

drop function if exists search_chunks(vector, int, text, text, text, boolean);

create function search_chunks(
  query_embedding   vector(1536),
  match_count       int default 10,
  filter_informant  text default null,
  filter_category   text default null,
  filter_source     text default null,
  filter_mantis     boolean default null
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
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join stories s on s.id = c.story_id
  where (filter_informant is null or s.informant = filter_informant)
    and (filter_category  is null or s.category  = filter_category)
    and (filter_source    is null or s.source    = filter_source)
    and (filter_mantis    is null or s.mantis_cycle = filter_mantis)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

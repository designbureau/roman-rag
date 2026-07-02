-- Background / reference corpus, gated by a reader toggle.
--
-- Smith's Dictionary and Fowler's "Social Life at Rome" are not any figure's
-- own words — they are background about the Roman world. They are marked
-- is_reference = true and enter retrieval ONLY when the reader turns the
-- "Roman context" toggle on (search_chunks.filter_include_reference). The
-- primary material (a figure's own writings) is filtered by author as before;
-- reference material ignores the author scope and is included whole when the
-- toggle is on.

alter table stories add column if not exists is_reference boolean not null default false;
create index if not exists stories_is_reference_idx on stories (is_reference);

drop function if exists search_chunks(vector, int, text, text, text, boolean, text);

create function search_chunks(
  query_embedding         vector(1536),
  match_count             int default 10,
  filter_informant        text default null,
  filter_category         text default null,
  filter_source           text default null,
  filter_mantis           boolean default null,
  filter_author           text default null,
  filter_include_reference boolean default false
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
  is_reference boolean,
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
    s.is_reference,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join stories s on s.id = c.story_id
  where (filter_informant is null or s.informant = filter_informant)
    and (filter_category  is null or s.category  = filter_category)
    and (filter_source    is null or s.source    = filter_source)
    and (filter_mantis    is null or s.mantis_cycle = filter_mantis)
    and (
      -- primary material: a figure's own words, scoped by author as before
      (s.is_reference = false and (filter_author is null or s.author = filter_author))
      -- background material: only when the reader opts in (ignores author scope)
      or (s.is_reference = true and coalesce(filter_include_reference, false))
    )
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

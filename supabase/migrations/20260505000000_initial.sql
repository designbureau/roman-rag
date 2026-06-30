-- Bleek-Lloyd RAG schema (data brief v2.1, lines 51-88 + 192-235)

create extension if not exists vector;

create table if not exists stories (
  id                       text primary key,
  source                   text not null,
  source_url               text not null,
  title                    text not null,
  informant                text,
  category                 text,
  cicero_ref          text,
  page_range               text,
  english_text             text not null,
  footnotes                jsonb,
  latin_text                 text,
  mantis_cycle             boolean default false,
  canonical_story_group    text,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create table if not exists chunks (
  id              uuid primary key default gen_random_uuid(),
  story_id        text not null references stories(id) on delete cascade,
  chunk_type      text not null check (chunk_type in ('story', 'paragraph')),
  content         text not null,
  paragraph_index int,
  embedding       vector(1536) not null,
  created_at      timestamptz default now()
);

-- Idempotency anchor for the embed pipeline
create unique index if not exists chunks_unique_per_story_idx
  on chunks (story_id, chunk_type, coalesce(paragraph_index, -1));

create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);
create index if not exists chunks_story_id_idx       on chunks (story_id);
create index if not exists stories_informant_idx     on stories (informant);
create index if not exists stories_category_idx      on stories (category);
create index if not exists stories_source_idx        on stories (source);
create index if not exists stories_mantis_idx        on stories (mantis_cycle) where mantis_cycle = true;

create or replace function search_chunks(
  query_embedding   vector(1536),
  match_count       int default 10,
  filter_informant  text default null,
  filter_category   text default null,
  filter_source     text default null,
  filter_mantis     boolean default null
)
returns table (
  chunk_id      uuid,
  story_id      text,
  story_title   text,
  source        text,
  informant     text,
  category      text,
  mantis_cycle  boolean,
  chunk_type    text,
  content       text,
  source_url    text,
  latin_text      text,
  similarity    float
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

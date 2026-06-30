-- Stow rock-art images: a separate vector index over BAL2's George Stow
-- collection. Decoupled from `stories` so the existing chunk-embedding
-- index isn't diluted by image descriptions; the chat function calls
-- search_chunks for text and search_images for the related-image card.

create table if not exists images (
  id            text primary key,           -- e.g. "stow-rock-art-170"
  source        text not null,              -- "stow-rock-art"
  title         text not null,              -- e.g. "stow_162"
  description   text not null,              -- prose description used for embedding
  image_url     text not null,              -- full plate
  thumb_url     text,                       -- thumbnail URL
  source_url    text not null,              -- BAL2 metadata page URL
  size          text,                       -- as printed (e.g. "674mmx507mm")
  embedding     vector(1536) not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists images_embedding_idx
  on images using hnsw (embedding vector_cosine_ops);
create index if not exists images_source_idx
  on images (source);

create or replace function search_images(
  query_embedding vector(1536),
  match_count     int default 1
)
returns table (
  id            text,
  source        text,
  title         text,
  description   text,
  image_url     text,
  thumb_url     text,
  source_url    text,
  similarity    float
)
language sql stable as $$
  select
    id,
    source,
    title,
    description,
    image_url,
    thumb_url,
    source_url,
    1 - (embedding <=> query_embedding) as similarity
  from images
  order by embedding <=> query_embedding
  limit match_count;
$$;

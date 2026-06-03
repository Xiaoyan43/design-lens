-- DesignLens — catalogue table for extracted design assets.
-- Phase 2 (storage + search). The MVP /extract endpoint works without this.

create extension if not exists "pgcrypto";
-- For semantic search later:
-- create extension if not exists vector;

create table if not exists design_assets (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),
    owner           uuid,                       -- auth.uid() once wired to Supabase Auth
    image_path      text,                       -- path in the 'design-images' storage bucket

    -- structured attributes
    building_type       text,
    architectural_style text[] default '{}',
    primary_materials   text[] default '{}',
    storeys             text,
    key_features        text[] default '{}',
    setting             text,
    colour_palette      text[] default '{}',
    mood_tags           text[] default '{}',

    -- bilingual copy
    description_en  text,
    description_zh  text,
    alt_text_en     text,
    alt_text_zh     text,
    seo_keywords    text[] default '{}',

    -- provenance / trust
    confidence              real,
    low_confidence_fields   text[] default '{}',
    model                   text,
    raw                     jsonb,              -- full validated extraction

    -- embedding for semantic search (phase 2)
    -- embedding vector(1024),

    constraint confidence_range check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists design_assets_building_type_idx on design_assets (building_type);
create index if not exists design_assets_setting_idx       on design_assets (setting);
-- create index if not exists design_assets_embedding_idx on design_assets
--     using ivfflat (embedding vector_cosine_ops);

-- Row Level Security: each user sees only their own rows.
alter table design_assets enable row level security;
create policy "own rows" on design_assets
    for all using (owner = auth.uid()) with check (owner = auth.uid());

-- Storage: create a private bucket named 'design-images' in the Supabase dashboard.

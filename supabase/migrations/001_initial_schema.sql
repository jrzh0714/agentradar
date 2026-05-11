-- ============================================================
-- AgentRadar — Initial Schema
-- Migration: 001_initial_schema.sql
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

-- gen_random_uuid() is available by default in Supabase (pgcrypto)
-- No additional extensions needed for this migration.


-- ============================================================
-- 2. UTILITY: updated_at trigger function
-- ============================================================

create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 3. TABLES
-- ============================================================

-- ------------------------------------------------------------
-- items: all ingested content from GitHub, HN, and RSS
-- ------------------------------------------------------------
create table if not exists items (
  -- identity
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  url             text not null,
  canonical_url   text unique,           -- deduplication key; nulls do not conflict
  source          text not null check (source in ('github', 'hackernews', 'rss')),
  source_id       text,                  -- repo full_name, HN story id, RSS guid
  author          text,
  description     text,
  raw_content     text,                  -- full body/readme if fetched
  raw_data        jsonb,                 -- original API payload

  -- timing
  published_at    timestamptz,
  discovered_at   timestamptz not null default now(),

  -- github-specific
  github_stars    int,
  github_forks    int,
  github_language text,

  -- hacker news-specific
  hn_points       int,
  hn_comments     int,

  -- AI enrichment (populated by enrich-items script)
  ai_summary          text,
  ai_why_it_matters   text,
  ai_category         text,
  ai_tags             text[],
  ai_audience         text[],
  ai_maturity         text,
  ai_relevance_score  numeric(4, 3) check (ai_relevance_score >= 0 and ai_relevance_score <= 1),

  -- ranking / pipeline state
  ranking_score   numeric(10, 4) not null default 0,
  status          text not null default 'new' check (status in ('new', 'enriched', 'failed')),
  error_message   text,

  -- timestamps
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger items_updated_at
  before update on items
  for each row execute function update_updated_at();


-- ------------------------------------------------------------
-- digests: weekly (or periodic) curated digests
-- ------------------------------------------------------------
create table if not exists digests (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  period_start    date not null,
  period_end      date not null,
  summary         text,
  created_at      timestamptz not null default now(),

  constraint digests_period_check check (period_end >= period_start)
);

create index if not exists digests_period_start_idx on digests (period_start desc);
create index if not exists digests_period_end_idx   on digests (period_end   desc);


-- ------------------------------------------------------------
-- digest_items: ordered join between digests and items
-- ------------------------------------------------------------
create table if not exists digest_items (
  digest_id   uuid not null references digests(id) on delete cascade,
  item_id     uuid not null references items(id)   on delete cascade,
  rank        int  not null,
  section     text,
  primary key (digest_id, item_id)
);

create index if not exists digest_items_item_idx on digest_items (item_id);


-- ------------------------------------------------------------
-- rss_feeds: configurable list of RSS sources
-- ------------------------------------------------------------
create table if not exists rss_feeds (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  url             text not null unique,
  active          boolean not null default true,
  category_hint   text,                  -- hint passed to AI enrichment (e.g. 'ai-research')
  created_at      timestamptz not null default now()
);


-- ============================================================
-- 4. INDEXES ON items
-- ============================================================

create index if not exists items_source_idx        on items (source);
create index if not exists items_status_idx        on items (status);
create index if not exists items_ai_category_idx   on items (ai_category);
create index if not exists items_published_at_idx  on items (published_at desc nulls last);
create index if not exists items_ranking_score_idx on items (ranking_score desc);
create index if not exists items_created_at_idx    on items (created_at desc);
-- canonical_url already has an index via the UNIQUE constraint


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
-- All writes go through the service role key (server-only).
-- Public read access is granted to anon for all four tables.

alter table items        enable row level security;
alter table digests      enable row level security;
alter table digest_items enable row level security;
alter table rss_feeds    enable row level security;

-- Public read
create policy "items: public read"
  on items for select
  to anon
  using (true);

create policy "digests: public read"
  on digests for select
  to anon
  using (true);

create policy "digest_items: public read"
  on digest_items for select
  to anon
  using (true);

create policy "rss_feeds: public read"
  on rss_feeds for select
  to anon
  using (true);

-- Service role bypasses RLS by default — no additional policy needed for writes.


-- ============================================================
-- 6. SEED: RSS feeds from config/rss-feeds.ts
-- ============================================================

insert into rss_feeds (name, url, category_hint) values
  ('OpenAI Blog',          'https://openai.com/blog/rss.xml',            'ai-research'),
  ('Hugging Face Blog',    'https://huggingface.co/blog/feed.xml',       'ai-research'),
  ('GitHub Blog',          'https://github.blog/feed/',                  'developer-tools'),
  ('LangChain Blog',       'https://www.langchain.com/blog/rss.xml',     'agent-frameworks'),
  ('Vercel Blog',          'https://vercel.com/atom',                    'developer-tools'),
  ('Simon Willison''s Blog','https://simonwillison.net/atom/everything/', 'ai-engineering')
on conflict (url) do nothing;

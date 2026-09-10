-- Keep potentially long-running index work separate from the security and
-- pipeline-lease migration. Apply this file during a low-traffic window.

-- Match the application's hot paths. Partial indexes stay compact because
-- public feeds and search only return enriched items.
create index if not exists items_enriched_ranking_idx
  on public.items (ranking_score desc)
  where status = 'enriched';
create index if not exists items_enriched_published_idx
  on public.items (published_at desc nulls last)
  where status = 'enriched';
create index if not exists items_enriched_relevance_idx
  on public.items (ai_relevance_score desc)
  where status = 'enriched';
create index if not exists items_enriched_github_stars_idx
  on public.items (github_stars desc nulls last)
  where status = 'enriched';
create index if not exists items_enriched_hn_points_idx
  on public.items (hn_points desc nulls last)
  where status = 'enriched';

-- Substring search needs pg_trgm; B-tree indexes cannot accelerate leading
-- wildcard ILIKE expressions. Resolve the operator class dynamically because
-- older projects may have installed pg_trgm outside the extensions schema.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

do $$
declare
  trgm_schema text;
begin
  select quote_ident(n.nspname)
  into strict trgm_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_trgm';

  execute format(
    'create index if not exists items_title_trgm_idx on public.items using gin (title %s.gin_trgm_ops) where status = ''enriched''',
    trgm_schema
  );
  execute format(
    'create index if not exists items_description_trgm_idx on public.items using gin (description %s.gin_trgm_ops) where status = ''enriched''',
    trgm_schema
  );
  execute format(
    'create index if not exists items_ai_summary_trgm_idx on public.items using gin (ai_summary %s.gin_trgm_ops) where status = ''enriched''',
    trgm_schema
  );
  execute format(
    'create index if not exists items_ai_why_it_matters_trgm_idx on public.items using gin (ai_why_it_matters %s.gin_trgm_ops) where status = ''enriched''',
    trgm_schema
  );
  execute format(
    'create index if not exists items_ai_category_trgm_idx on public.items using gin (ai_category %s.gin_trgm_ops) where status = ''enriched''',
    trgm_schema
  );
  execute format(
    'create index if not exists items_source_trgm_idx on public.items using gin (source %s.gin_trgm_ops) where status = ''enriched''',
    trgm_schema
  );
end
$$;
create index if not exists items_ai_tags_gin_idx
  on public.items using gin (ai_tags)
  where status = 'enriched';
create index if not exists items_ai_audience_gin_idx
  on public.items using gin (ai_audience)
  where status = 'enriched';

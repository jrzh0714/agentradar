-- Pipeline run log — stores a record after every daily refresh.
-- Used by /status page to surface health without needing Vercel log access.

create table if not exists pipeline_runs (
  id            uuid        primary key default gen_random_uuid(),
  ran_at        timestamptz not null    default now(),
  success       boolean     not null,
  -- ingestion
  ingested_github   int     not null    default 0,
  ingested_hn       int     not null    default 0,
  ingested_rss      int     not null    default 0,
  -- processing
  enriched_count            int     not null default 0,
  failed_count              int     not null default 0,
  ranked_count              int     not null default 0,
  translated_count          int     not null default 0,
  trending_count            int     not null default 0,
  digest_summaries_generated int    not null default 0,
  anomalies_found           int     not null default 0,
  duration_ms               int     not null default 0,
  -- error info (null when success)
  error         text,
  estimated_cost jsonb
);

-- Recent-runs queries always order by ran_at desc.
create index if not exists pipeline_runs_ran_at_idx on pipeline_runs (ran_at desc);

-- supabase/migrations/002_group_a_schema.sql

-- ── Trend detection ───────────────────────────────────────────────────────────
ALTER TABLE items ADD COLUMN IF NOT EXISTS trending              boolean DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS ranking_score_7d_ago  numeric(10,4);
ALTER TABLE items ADD COLUMN IF NOT EXISTS score_snapshot_date   date;

-- ── Re-classification ─────────────────────────────────────────────────────────
ALTER TABLE items ADD COLUMN IF NOT EXISTS needs_reclassification boolean DEFAULT false;

-- ── Digest summaries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digest_summaries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text NOT NULL,
  summary       text NOT NULL,
  week_of       date NOT NULL,
  generated_at  timestamptz DEFAULT now(),
  UNIQUE (category, week_of)
);

-- ── Indexes for digest_summaries ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS digest_summaries_category_idx ON digest_summaries (category);
CREATE INDEX IF NOT EXISTS digest_summaries_week_of_idx  ON digest_summaries (week_of DESC);

-- ── Indexes for new items columns (used in WHERE filters) ─────────────────────
CREATE INDEX IF NOT EXISTS items_trending_idx              ON items (trending DESC);
CREATE INDEX IF NOT EXISTS items_needs_reclassification_idx ON items (needs_reclassification);

-- ── RLS for digest_summaries (mirrors existing tables' security model) ────────
ALTER TABLE digest_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digest_summaries: public read"
  ON digest_summaries FOR SELECT
  TO anon
  USING (true);

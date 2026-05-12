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

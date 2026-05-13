-- Migration 003: Simplified Chinese translation fields
-- Adds nullable text columns for AI-translated content.
-- Falls back to English when null — no existing rows are affected.

ALTER TABLE items ADD COLUMN IF NOT EXISTS ai_summary_zh           text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS ai_why_it_matters_zh    text;

-- Index for querying untranslated enriched items efficiently
CREATE INDEX IF NOT EXISTS items_needs_translation_idx
  ON items (status, ai_summary_zh)
  WHERE status = 'enriched' AND ai_summary IS NOT NULL AND ai_summary_zh IS NULL;

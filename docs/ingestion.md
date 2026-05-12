# AgentRadar — Ingestion Pipeline

This document describes how items enter the AgentRadar corpus, how quality filters work, and how to operate the ingestion scripts.

---

## Data sources

| Source | Script | npm command |
|---|---|---|
| GitHub Search API | `scripts/ingest-github.ts` | `npm run ingest:github` |
| Hacker News Algolia | `scripts/ingest-hn.ts` | `npm run ingest:hn` |
| RSS feeds | `scripts/ingest-rss.ts` | `npm run ingest:rss` |
| All at once | `scripts/ingest-all.ts` | `npm run ingest:all` |

After ingestion, run enrichment and ranking:

```bash
npm run enrich   # annotate new items with AI metadata
npm run rank     # recompute ranking_score for all enriched items
```

---

## GitHub ingestion

### Search queries

Queries are defined in `config/github-queries.ts`. Each entry is a GitHub Search API query string; they run sequentially with a 1-second delay to respect rate limits.

**All queries include `fork:false`** — this is the most important quality gate. The GitHub Search API can return fork repos whose `stargazers_count` reflects the upstream repository's stars rather than the fork's actual stars. Without this qualifier, forks with inflated star counts dominate ranking.

#### Changing queries

Edit `config/github-queries.ts`. The `GITHUB_RESULTS_PER_QUERY` constant controls `per_page` (max 100 per GitHub's API).

### Quality filters (applied after API response)

Even with `fork:false` in the search query, `lib/ingestion/github.ts` applies defensive per-repo checks:

| Filter | Condition | Reason |
|---|---|---|
| **Fork guard** | `repo.fork === true` | Defence-in-depth; catches any forks the search qualifier misses |
| **Archived** | `repo.archived === true` | Unmaintained repos shouldn't rank alongside active projects |
| **Disabled** | `repo.disabled === true` | Disabled repos return 404 on GitHub |
| **No description** | `description` is empty AND `stars < 100` | Removes stub/placeholder repos; high-star repos are kept even without descriptions |

### `published_at` logic

`published_at` is set to `pushed_at` (the timestamp of the last commit push). This reflects real content activity rather than the ingestion timestamp. `created_at` is preserved in `raw_data` for reference.

### Logging

Each query logs a one-line summary:

```
  → query: "ai agent stars:>50 fork:false"
    fetched 15 · forks 0 · archived 1 · disabled 0 · no-desc 2 · accepted 12
```

A full summary is printed at the end of the run.

---

## Cleanup: removing fork artifacts

If fork repos were ingested before the `fork:false` qualifier was added, run the cleanup script:

```bash
npm run cleanup:github            # live delete
npm run cleanup:github -- --dry-run  # preview, no deletes
```

The script does two passes:

1. **DB-wide fork scan** — deletes all GitHub rows where `raw_data.fork = true`
2. **Known-bad list** — deletes hardcoded source_ids identified by data audit

After cleanup, re-ingest, enrich, and rank:

```bash
npm run cleanup:github
npm run ingest:github
npm run enrich
npm run rank
```

### Adding records to the known-bad list

Edit `KNOWN_BAD_SOURCE_IDS` at the top of `scripts/cleanup-github-artifacts.ts`.

### Equivalent SQL (for direct Supabase/psql access)

```sql
-- Delete all fork artifacts
DELETE FROM items
WHERE source = 'github'
  AND (raw_data->>'fork')::boolean = true;

-- Delete specific known-bad repos
DELETE FROM items
WHERE source = 'github'
  AND source_id IN (
    'affaan-m/everything-claude-code',
    'anomalyco/opencode'
  );
```

---

## Hacker News ingestion

Fetches recent AI-relevant stories from the HN Algolia API. Filters by minimum points and a keyword allowlist. See `scripts/ingest-hn.ts` for configuration.

## RSS ingestion

Fetches configured feeds from `config/rss-feeds.ts` (or equivalent). Parses and normalises article metadata. See `scripts/ingest-rss.ts` for feed list.

---

## Enrichment

`scripts/enrich-items.ts` calls the AI model (OpenAI gpt-4o-mini or Anthropic Claude) on items with `status = 'new'`. Outputs are validated with Zod before being written to the database. Enriched items receive `status = 'enriched'`.

## Ranking

`scripts/rank-items.ts` computes `ranking_score` for all `status = 'enriched'` items. Paginates through the full corpus in batches of 500 to avoid Supabase's implicit 1,000-row cap. See `lib/ranking/score.ts` for the formula.

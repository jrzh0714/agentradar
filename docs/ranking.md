# Ranking

AgentRadar ranks enriched items using a weighted composite score stored in the `ranking_score` column (`numeric(10,4)`, range 0–100).

## Running the ranker

```bash
# Rank all enriched items and write scores to the DB
npm run rank

# Dry-run: compute and preview scores, no DB writes
npm run rank -- --dry-run

# Rank a subset (useful after partial enrichment)
npm run rank -- --limit 200
```

Items where `ai_relevance_score IS NULL` (unenriched) are skipped — `ranking_score` stays 0.

## Formula

```
ranking_score = weighted_sum × low_relevance_penalty
```

**Weighted components** (each 0–100):

| Component | Weight | Description |
|---|---|---|
| `ai_relevance` | 40 % | `ai_relevance_score × 100` |
| `recency` | 25 % | Exponential decay from `published_at` (or `discovered_at`) |
| `source_quality` | 10 % | Fixed per-source base score |
| `github_momentum` | 15 % | Log-scaled stars + forks, normalised to corpus max |
| `hn_discussion` | 10 % | Log-scaled points + comments |

### Recency decay

Uses the item's `published_at` timestamp; falls back to `discovered_at` if null.

```
score = clamp(10, 100,  10 + 90 × e^(−ageDays / 14))
```

| Age | Score |
|---|---|
| 0 days | 100 |
| 7 days | ~65 |
| 14 days | ~43 |
| 30 days | ~17 |
| 90+ days | ~10 (floor) |

### Source quality

| Source | Score |
|---|---|
| `github` | 90 |
| `hackernews` | 80 |
| `rss` | 65 |

### GitHub momentum

```
starComponent  = log(stars + 1) / log(maxStars + 1)
forkComponent  = log(forks + 1) / log(maxStars + 1)
score          = clamp(0, 100,  (starComponent × 0.80 + forkComponent × 0.20) × 100)
```

`maxStars` is derived from the highest star count in the **current batch** being ranked, so scores are relative to your corpus. Non-GitHub items score 0 on this component.

### HN discussion

```
score = clamp(0, 100,  log(points + comments + 1) / log(1001) × 100)
```

A combined signal of 1 000 (e.g. 500 points + 500 comments) maps to 100. Non-HN items score 0.

### Low-relevance penalty

Applied after weighting to suppress low-quality content even when it has strong recency or star counts.

| `ai_relevance_score` | Multiplier |
|---|---|
| < 0.4 | × 0.35 |
| 0.4 – 0.49 | × 0.65 |
| ≥ 0.5 | × 1.00 (no penalty) |

## Implementation

| File | Role |
|---|---|
| `lib/ranking/score.ts` | Pure scoring functions, exported for testing |
| `scripts/rank-items.ts` | CLI — fetches items, computes scores, writes to DB |

### Key exports from `lib/ranking/score.ts`

```typescript
computeRankingScore(item: RankableItem, opts?: RankingOptions): ScoreBreakdown
recencyScore(publishedAt, discoveredAt, now?): number
githubMomentumScore(stars, forks, maxStars): number
hnDiscussionScore(points, comments): number
relevancePenalty(aiRelevanceScore): number
```

`ScoreBreakdown` includes per-component scores, `weighted`, `penalty`, and `final`.

## Re-ranking

Re-run `npm run rank` at any time. It overwrites existing scores for all enriched items. Run after:

- A batch of new items is enriched
- The scoring formula or weights change
- The corpus grows significantly (maxStars normalisation shifts)

## Tests

```bash
npm test
```

10 unit tests covering: null-relevance skip, recency decay, recency fallback to `discovered_at`, GitHub momentum edge cases, penalty tier transitions, and full-score range validation.

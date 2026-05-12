# Group A — Pipeline Extensions Design

**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** Five pipeline extension features added to the AgentRadar daily refresh workflow.

---

## Features in scope

1. Cost estimation pre-flight
2. Trend detection (7-day delta)
3. Data quality monitoring (health endpoint + Slack)
4. AI digest summaries (weekly, per category)
5. Category re-classification agent

---

## Architecture

### Approach: Modular phase files, thin orchestrator

Each feature lives in its own file under `lib/workflows/`. The existing `daily-refresh.ts` imports and orchestrates them in sequence. No new Vercel Cron routes — all phases run within the single daily cron.

### New files

```
lib/workflows/
  trend-detection.ts        # snapshot + delta computation
  digest-summaries.ts       # weekly LLM pass per category
  reclassification.ts       # targeted re-enrichment pass
  data-quality.ts           # anomaly checks + Slack ping
  cost-estimation.ts        # item count + rate → estimated cost

app/api/
  pipeline/estimate/route.ts   # dry-run cost endpoint (CRON_SECRET protected)
  health/route.ts              # structured anomaly report (public)

lib/db/
  digest-summaries.ts          # read/write digest_summaries table

components/ui/
  TrendingBadge.tsx            # "↑ trending" orange pill
```

### Updated `runDailyRefresh` phase order

```
1. estimatePipelineCost()        ← new, pre-ingestion snapshot
2. runIngestion()                ← existing
3. runTitleCleanup()             ← existing
4. runTrendSnapshot()            ← new, weekly (skips if already ran today)
5. runEnrichment()               ← existing
6. runReclassification()         ← new
7. runRanking()                  ← existing
8. runTrendFlagUpdate()          ← new, post-ranking
9. runDigestSummaries()          ← new, Mondays only
10. runDataQualityCheck()        ← new, always runs
```

### Updated `RefreshResult` shape

```ts
export interface RefreshResult {
  success: boolean
  ingestionCounts: IngestionCounts
  titleFixedCount: number
  enrichedCount: number
  failedCount: number
  reclassifiedCount: number          // new
  rankedCount: number
  trendingCount: number              // new
  digestSummariesGenerated: number   // new
  anomaliesFound: number             // new
  estimatedCost: CostEstimate        // new
  durationMs: number
  error?: string
}
```

---

## Database schema changes

**Migration:** `supabase/migrations/002_group_a_schema.sql`

### `items` table — new columns

```sql
-- Trend detection
trending              boolean DEFAULT false
ranking_score_7d_ago  numeric(10,4)
score_snapshot_date   date

-- Re-classification
needs_reclassification boolean DEFAULT false
```

All columns are nullable or have safe defaults — existing rows unaffected.

### New `digest_summaries` table

```sql
CREATE TABLE digest_summaries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text NOT NULL,
  summary       text NOT NULL,
  week_of       date NOT NULL,
  generated_at  timestamptz DEFAULT now(),
  UNIQUE (category, week_of)
);
```

---

## Feature specifications

### 1. Cost estimation (`lib/workflows/cost-estimation.ts`)

**Function:** `estimatePipelineCost(enrichLimit: number): Promise<CostEstimate>`

- Counts items where `status = 'new' OR ai_summary IS NULL`, capped at `enrichLimit`
- Provider: `openai`, model: `gpt-4o-mini`, rate: `$0.0002` per item (≈ 600 input + 200 output tokens)
- Returns:

```ts
interface CostEstimate {
  pendingItems: number
  willProcess: number
  ratePerItem: number
  estimatedUsd: number
  model: string
  provider: string
}
```

Called at the top of `runDailyRefresh` (pre-ingestion) and included in `RefreshResult`.

**Route: `GET /api/pipeline/estimate`**
- Auth: `Authorization: Bearer <CRON_SECRET>`
- Query param: `?limit=N` (defaults to `DAILY_ENRICH_LIMIT`)
- Returns `CostEstimate` as JSON

---

### 2. Trend detection (`lib/workflows/trend-detection.ts`)

**Function 1:** `runTrendSnapshot(): Promise<{ snapshotted: number }>`

- Checks `score_snapshot_date` on enriched items
- Snapshots when `score_snapshot_date IS NULL OR score_snapshot_date <= today - 7 days`: copies `ranking_score → ranking_score_7d_ago`, sets `score_snapshot_date = today`
- This guarantees `ranking_score_7d_ago` is always at least 7 days old — the delta is a true 7-day comparison
- Items snapshotted less than 7 days ago are skipped (no write)
- Paginated in batches of 500

**Function 2:** `runTrendFlagUpdate(): Promise<{ trendingCount: number }>`

- Runs after ranking every day
- Sets `trending = true` where `ranking_score - ranking_score_7d_ago >= 20` AND `ranking_score_7d_ago IS NOT NULL`
- Clears `trending = false` on all other items
- Concurrent writes, `RANK_WRITE_CONCURRENCY = 50`

**UI: `TrendingBadge` component**

```tsx
// Orange pill in ItemCard metadata row
<span className="inline-flex items-center rounded border border-orange-800/50 bg-orange-950/40 px-1.5 py-0.5 font-mono text-[10px] font-medium text-orange-400">
  ↑ trending
</span>
```

Cards with `trending = true` additionally receive `border-l-2 border-orange-500` left accent. Applied in `ItemCard.tsx`, digest rows, and search results.

---

### 3. Digest summaries (`lib/workflows/digest-summaries.ts`)

**Function:** `runDigestSummaries(): Promise<{ generated: number, skipped: number }>`

- Runs only on Mondays (`new Date().getDay() === 1`); returns `{ generated: 0, skipped: 0 }` on other days
- For each of 13 categories with ≥ 3 enriched items:
  - Fetches top 5 items by `ranking_score`
  - Builds prompt from titles + AI summaries
  - Calls `gpt-4o-mini` via existing provider abstraction
  - Validates response: string, 50–300 characters
  - Upserts into `digest_summaries` keyed on `(category, week_of)` where `week_of` = current Monday
- Categories with < 3 items are skipped (counted in `skipped`)
- One LLM call per category, max 13 calls/week

**DB helper: `lib/db/digest-summaries.ts`**

```ts
export async function getDigestSummariesForWeek(weekOf: Date): Promise<Map<string, string>>
```

Returns a `Map<category, summary>` for the given week. Used by the digest page.

**Digest page UI**

`DigestSectionBlock` receives an optional `summary?: string` prop. When present, renders a callout box between the section heading and the items list:

```
┌─────────────────────────────────────────┐
│ THIS WEEK                               │
│ Three frameworks reached production-    │
│ ready maturity this week...             │
└─────────────────────────────────────────┘
  1. Item one
  2. Item two
```

Styled with `border-l-2 border-indigo-600 bg-zinc-900 px-5 py-4`. Omitted entirely when no summary exists — no placeholder shown.

---

### 4. Re-classification (`lib/workflows/reclassification.ts`)

**Function:** `runReclassification(): Promise<{ reclassified: number, failed: number }>`

- Queries items where `ai_relevance_score < 0.5 OR ai_category = 'Other'`, limit 20 per run
- For each item: calls `enrichItem()` (existing function, same Zod schema)
- On success: updates `ai_category`, `ai_tags`, `ai_relevance_score`; sets `needs_reclassification = false`
- On failure: sets `needs_reclassification = true` (retried next run)
- Uses same `ENRICH_DELAY_MS = 500` rate limiting between calls

Items successfully re-classified feed into the subsequent ranking phase in the same run.

---

### 5. Data quality monitoring (`lib/workflows/data-quality.ts`)

**Function:** `runDataQualityCheck(): Promise<HealthReport>`

Anomaly checks (all via Supabase queries):

| Anomaly | Query |
|---|---|
| `stuckNew` | `status = 'new'` AND `created_at < now() - interval '48 hours'` |
| `failedCount` | `status = 'failed'` |
| `unranked` | `status = 'enriched'` AND `ranking_score = 0` |
| `missingCategory` | `status = 'enriched'` AND `ai_category IS NULL` |
| `emptySections` | Iterates all 13 known `ai_category` enum values; lists any with 0 enriched items as `string[]` |

```ts
interface HealthReport {
  healthy: boolean
  checkedAt: string           // ISO timestamp
  anomalies: {
    stuckNew: number
    failedCount: number
    unranked: number
    missingCategory: number
    emptySections: string[]
  }
}
```

`healthy = true` only when all counts are 0 and `emptySections` is empty.

**Slack notification**

When `healthy = false` AND `SLACK_WEBHOOK_URL` is set: posts a formatted message listing each non-zero anomaly. Silent skip if env var unset. Uses `fetch()` — no new dependencies.

**Route: `GET /api/health`**

- No auth required (read-only, no secrets exposed)
- Returns `HealthReport` as JSON
- HTTP 200 always (even when `healthy: false`) — so uptime monitors detect route failure, not data issues

---

## UI changes summary

| Component | Change |
|---|---|
| `components/ui/TrendingBadge.tsx` | New component — orange `"↑ trending"` pill |
| `components/ItemCard.tsx` | Add `TrendingBadge` when `item.trending`; add orange left border |
| `app/digest/page.tsx` | Pass `summary` prop to `DigestSectionBlock`; fetch from `digest-summaries` |
| `app/digest/page.tsx` — `DigestSectionBlock` | Render indigo callout above items when summary present |

---

## Error handling

| Failure | Behaviour |
|---|---|
| Digest summary LLM fails for one category | Logged, category skipped, others continue |
| Slack webhook unreachable | Logged as warning, health report still returned |
| `SLACK_WEBHOOK_URL` not set | Silent skip |
| Trend snapshot already ran today | Early return `{ snapshotted: 0 }` |
| Re-classification item fails validation | `needs_reclassification = true`, retried next run |
| `/api/health` Supabase query fails | Returns `{ healthy: false, error: "..." }`, HTTP 200 |
| `CRON_SECRET` not set on estimate route | Returns 401 |

All workflow functions return result objects. None throw. Phase failures do not abort subsequent phases.

---

## New environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook for anomaly alerts. Silent skip if unset. |

---

## Testing

New unit test files (pure logic only, no DB):

| File | What's tested |
|---|---|
| `lib/workflows/trend-detection.test.ts` | Delta threshold (≥20), snapshot skip logic, `trending` flag derivation |
| `lib/workflows/cost-estimation.test.ts` | `willProcess = min(pending, limit)`, rate × count calculation, model rate map |
| `lib/workflows/data-quality.test.ts` | `healthy` flag derivation from anomaly counts, `HealthReport` shape |

Target: +15–20 tests, suite grows from 54 → ~70.

DB-touching functions are integration-level — covered by manual QA against the live DB.

---

## New npm scripts

```bash
npm run health        # curl /api/health — quick anomaly check
npm run estimate      # curl /api/pipeline/estimate — pre-run cost preview
```

---

## Deployment notes

1. Run `supabase/migrations/002_group_a_schema.sql` before deploying
2. Add `SLACK_WEBHOOK_URL` to Vercel env vars (optional)
3. Redeploy — cron picks up new phases automatically
4. Verify `/api/health` returns `{ healthy: true }` after first cron run

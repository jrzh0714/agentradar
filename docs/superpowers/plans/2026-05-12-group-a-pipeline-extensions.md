# Group A — Pipeline Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five pipeline extensions to AgentRadar: cost estimation pre-flight, 7-day trend detection with UI badges, data quality monitoring with Slack alerts, weekly AI digest summaries per category, and category re-classification agent.

**Architecture:** Each feature is a standalone module in `lib/workflows/`. `daily-refresh.ts` imports and orchestrates them. Two new public/protected API routes expose monitoring and cost preview. DB changes are additive (new columns + one new table).

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase PostgREST, OpenAI `gpt-4o-mini` via existing `callAi()`, Node.js `node:test` for unit tests, Tailwind CSS.

---

## File map

| Action | File | Responsibility |
|---|---|---|
| Create | `supabase/migrations/002_group_a_schema.sql` | New columns + `digest_summaries` table |
| Modify | `lib/db/types.ts` | Add 4 new fields to `Item` |
| Modify | `lib/db/homepage.ts` | Add `trending` to `HomepageItem` + `ITEM_SELECT` |
| Modify | `lib/db/search.ts` | Add `trending` to search select |
| Modify | `lib/db/digest.ts` | Add `trending` to digest select |
| Create | `lib/workflows/cost-estimation.ts` | `estimatePipelineCost()` + pure `computeCostEstimate()` |
| Create | `lib/workflows/cost-estimation.test.ts` | Unit tests for pure cost logic |
| Create | `app/api/pipeline/estimate/route.ts` | `GET /api/pipeline/estimate` (CRON_SECRET protected) |
| Create | `lib/workflows/trend-detection.ts` | `runTrendSnapshot()`, `runTrendFlagUpdate()`, pure helpers |
| Create | `lib/workflows/trend-detection.test.ts` | Unit tests for `isTrending()`, `shouldSnapshot()` |
| Create | `components/ui/TrendingBadge.tsx` | Orange "↑ trending" pill |
| Modify | `components/ItemCard.tsx` | Add `TrendingBadge` + orange left border |
| Create | `lib/workflows/reclassification.ts` | `runReclassification()` |
| Create | `lib/workflows/data-quality.ts` | `runDataQualityCheck()` + pure `deriveHealthReport()` |
| Create | `lib/workflows/data-quality.test.ts` | Unit tests for `deriveHealthReport()` |
| Create | `app/api/health/route.ts` | `GET /api/health` (public) |
| Create | `lib/db/digest-summaries.ts` | `getDigestSummariesForWeek()` |
| Create | `lib/workflows/digest-summaries.ts` | `runDigestSummaries()` |
| Modify | `app/digest/page.tsx` | Pass summaries to `DigestSectionBlock`; render callout |
| Modify | `lib/workflows/daily-refresh.ts` | Wire all new phases; extend `RefreshResult` |
| Modify | `package.json` | Add new test files + `health`/`estimate` scripts |

---

## Task 1: DB migration

**Files:**
- Create: `supabase/migrations/002_group_a_schema.sql`

- [ ] **Create the migration file**

```sql
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
```

- [ ] **Run the migration in Supabase**

Open Supabase dashboard → SQL Editor → paste the file contents → Run.

- [ ] **Verify columns exist**

In Supabase Table Editor → `items` table, confirm `trending`, `ranking_score_7d_ago`, `score_snapshot_date`, `needs_reclassification` are present. Confirm `digest_summaries` table appears.

- [ ] **Commit**

```bash
git add supabase/migrations/002_group_a_schema.sql
git commit -m "feat: add group A schema — trend detection columns + digest_summaries table"
```

---

## Task 2: Update TypeScript types

**Files:**
- Modify: `lib/db/types.ts`
- Modify: `lib/db/homepage.ts`

- [ ] **Add new fields to `Item` in `lib/db/types.ts`**

After the `ranking_score` line, add:

```ts
  ranking_score: number
  // Trend detection
  trending: boolean
  ranking_score_7d_ago: number | null
  score_snapshot_date: string | null   // 'YYYY-MM-DD'
  needs_reclassification: boolean
  status: ItemStatus
```

(Replace the existing `ranking_score` + `status` lines with the block above.)

- [ ] **Add `trending` to `HomepageItem` in `lib/db/homepage.ts`**

In the `HomepageItem` Pick, add `'trending'` after `'ranking_score'`:

```ts
export type HomepageItem = Pick<
  Item,
  | 'id'
  | 'title'
  | 'url'
  | 'source'
  | 'description'
  | 'published_at'
  | 'github_stars'
  | 'github_forks'
  | 'github_language'
  | 'hn_points'
  | 'hn_comments'
  | 'ai_summary'
  | 'ai_why_it_matters'
  | 'ai_category'
  | 'ai_tags'
  | 'ai_maturity'
  | 'ai_relevance_score'
  | 'ranking_score'
  | 'trending'
>
```

- [ ] **Add `trending` to `ITEM_SELECT` in `lib/db/homepage.ts`**

```ts
const ITEM_SELECT = [
  'id', 'title', 'url', 'source', 'description', 'published_at',
  'github_stars', 'github_forks', 'github_language',
  'hn_points', 'hn_comments',
  'ai_summary', 'ai_why_it_matters', 'ai_category', 'ai_tags', 'ai_maturity',
  'ai_relevance_score', 'ranking_score', 'trending',
].join(', ')
```

- [ ] **Add `trending` to search and digest select strings**

In `lib/db/search.ts`, find the `.select(...)` call and add `trending` to the column list.

In `lib/db/digest.ts`, find the `.select(...)` call and add `trending` to the column list.

- [ ] **Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Commit**

```bash
git add lib/db/types.ts lib/db/homepage.ts lib/db/search.ts lib/db/digest.ts
git commit -m "feat: add trending field to Item type and all select strings"
```

---

## Task 3: Cost estimation — tests + module

**Files:**
- Create: `lib/workflows/cost-estimation.ts`
- Create: `lib/workflows/cost-estimation.test.ts`

- [ ] **Write failing tests**

```ts
// lib/workflows/cost-estimation.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCostEstimate, MODEL_RATES } from './cost-estimation'

describe('computeCostEstimate', () => {
  it('willProcess is capped at enrichLimit when pending > limit', () => {
    const r = computeCostEstimate(200, 150, 0.0002)
    assert.equal(r.willProcess, 150)
    assert.equal(r.pendingItems, 200)
  })

  it('willProcess equals pending when pending < limit', () => {
    const r = computeCostEstimate(30, 150, 0.0002)
    assert.equal(r.willProcess, 30)
  })

  it('estimatedUsd = willProcess * ratePerItem (rounded to 4dp)', () => {
    const r = computeCostEstimate(50, 150, 0.0002)
    assert.equal(r.estimatedUsd, 0.01)
  })

  it('zero pending items gives zero cost', () => {
    const r = computeCostEstimate(0, 150, 0.0002)
    assert.equal(r.estimatedUsd, 0)
    assert.equal(r.willProcess, 0)
  })

  it('returns ratePerItem unchanged', () => {
    const r = computeCostEstimate(10, 150, 0.0005)
    assert.equal(r.ratePerItem, 0.0005)
  })
})

describe('MODEL_RATES', () => {
  it('has a positive rate for gpt-4o-mini', () => {
    assert.ok(MODEL_RATES['gpt-4o-mini'] > 0)
  })

  it('gpt-4o-mini rate is between 0.0001 and 0.001', () => {
    assert.ok(MODEL_RATES['gpt-4o-mini'] >= 0.0001)
    assert.ok(MODEL_RATES['gpt-4o-mini'] <= 0.001)
  })

  it('mock provider has rate 0', () => {
    assert.equal(MODEL_RATES['mock'], 0)
  })
})
```

- [ ] **Run tests to verify they fail**

```bash
npx tsx --test lib/workflows/cost-estimation.test.ts
```

Expected: `Error: Cannot find module './cost-estimation'`

- [ ] **Implement the module**

```ts
// lib/workflows/cost-estimation.ts
import { createServerClient } from '@/lib/supabase/server'
import { activeModel } from '@/lib/ai/provider'

export const MODEL_RATES: Record<string, number> = {
  'gpt-4o-mini': 0.0002,
  'gpt-4o': 0.002,
  'claude-3-5-haiku-20241022': 0.0002,
  'claude-3-5-sonnet-20241022': 0.003,
  'mock': 0,
}

export interface CostEstimate {
  pendingItems: number
  willProcess: number
  ratePerItem: number
  estimatedUsd: number
  model: string
  provider: string
}

/** Pure — exported for unit tests. */
export function computeCostEstimate(
  pendingItems: number,
  enrichLimit: number,
  ratePerItem: number,
): Pick<CostEstimate, 'pendingItems' | 'willProcess' | 'ratePerItem' | 'estimatedUsd'> {
  const willProcess = Math.min(pendingItems, enrichLimit)
  return {
    pendingItems,
    willProcess,
    ratePerItem,
    estimatedUsd: Math.round(willProcess * ratePerItem * 10000) / 10000,
  }
}

export async function estimatePipelineCost(enrichLimit: number): Promise<CostEstimate> {
  const supabase = createServerClient()
  const { count, error } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .or('status.eq.new,ai_summary.is.null')

  if (error) throw new Error(`Cost estimation query failed: ${error.message}`)

  const pendingItems = count ?? 0
  const model = activeModel()
  const provider = process.env.AI_PROVIDER ?? 'openai'
  const ratePerItem = MODEL_RATES[model] ?? MODEL_RATES['gpt-4o-mini']

  return {
    ...computeCostEstimate(pendingItems, enrichLimit, ratePerItem),
    model,
    provider,
  }
}
```

- [ ] **Run tests to verify they pass**

```bash
npx tsx --test lib/workflows/cost-estimation.test.ts
```

Expected: `# pass 8`, `# fail 0`

- [ ] **Commit**

```bash
git add lib/workflows/cost-estimation.ts lib/workflows/cost-estimation.test.ts
git commit -m "feat: cost estimation module with unit tests"
```

---

## Task 4: Cost estimation API route

**Files:**
- Create: `app/api/pipeline/estimate/route.ts`

- [ ] **Create the route**

```ts
// app/api/pipeline/estimate/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { estimatePipelineCost } from '@/lib/workflows/cost-estimation'
import { DEFAULT_ENRICH_LIMIT } from '@/lib/workflows/daily-refresh'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.warn('[pipeline/estimate] CRON_SECRET is not set — all requests denied.')
    return false
  }
  return req.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limitParam = req.nextUrl.searchParams.get('limit')
  const enrichLimit =
    (limitParam ? parseInt(limitParam, 10) : null) ||
    parseInt(process.env.DAILY_ENRICH_LIMIT ?? String(DEFAULT_ENRICH_LIMIT), 10) ||
    DEFAULT_ENRICH_LIMIT

  try {
    const estimate = await estimatePipelineCost(enrichLimit)
    return NextResponse.json(estimate)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error }, { status: 500 })
  }
}
```

- [ ] **Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Commit**

```bash
git add app/api/pipeline/estimate/route.ts
git commit -m "feat: add /api/pipeline/estimate route for cost pre-flight"
```

---

## Task 5: Trend detection — tests + module

**Files:**
- Create: `lib/workflows/trend-detection.ts`
- Create: `lib/workflows/trend-detection.test.ts`

- [ ] **Write failing tests**

```ts
// lib/workflows/trend-detection.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isTrending, shouldSnapshot } from './trend-detection'

describe('isTrending', () => {
  it('returns true when delta >= 20', () => {
    assert.equal(isTrending(80, 55), true)   // delta = 25
  })

  it('returns true when delta is exactly 20', () => {
    assert.equal(isTrending(75, 55), true)   // delta = 20
  })

  it('returns false when delta is 19', () => {
    assert.equal(isTrending(74, 55), false)  // delta = 19
  })

  it('returns false when delta is negative', () => {
    assert.equal(isTrending(40, 80), false)
  })

  it('returns false when previousScore is null', () => {
    assert.equal(isTrending(80, null), false)
  })

  it('returns false when both scores are equal', () => {
    assert.equal(isTrending(50, 50), false)
  })
})

describe('shouldSnapshot', () => {
  it('returns true when lastSnapshotDate is null', () => {
    assert.equal(shouldSnapshot(null), true)
  })

  it('returns true when last snapshot was 8 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 8)
    assert.equal(shouldSnapshot(d.toISOString().split('T')[0]), true)
  })

  it('returns true when last snapshot was exactly 7 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    assert.equal(shouldSnapshot(d.toISOString().split('T')[0]), true)
  })

  it('returns false when last snapshot was 3 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    assert.equal(shouldSnapshot(d.toISOString().split('T')[0]), false)
  })

  it('returns false when last snapshot was today', () => {
    const today = new Date().toISOString().split('T')[0]
    assert.equal(shouldSnapshot(today), false)
  })
})
```

- [ ] **Run tests to verify they fail**

```bash
npx tsx --test lib/workflows/trend-detection.test.ts
```

Expected: `Error: Cannot find module './trend-detection'`

- [ ] **Implement the module**

```ts
// lib/workflows/trend-detection.ts
import { createServerClient } from '@/lib/supabase/server'

const TREND_THRESHOLD = 20
const SNAPSHOT_INTERVAL_DAYS = 7
const BATCH_SIZE = 500
const WRITE_CONCURRENCY = 50

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

export function isTrending(
  currentScore: number,
  previousScore: number | null,
): boolean {
  if (previousScore === null) return false
  return currentScore - previousScore >= TREND_THRESHOLD
}

export function shouldSnapshot(lastSnapshotDate: string | null): boolean {
  if (!lastSnapshotDate) return true
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - SNAPSHOT_INTERVAL_DAYS)
  cutoff.setHours(0, 0, 0, 0)
  const last = new Date(lastSnapshotDate + 'T00:00:00')
  return last <= cutoff
}

// ── DB phases ──────────────────────────────────────────────────────────────────

/**
 * Copies ranking_score → ranking_score_7d_ago for items whose snapshot
 * is older than 7 days (or has never been taken).
 * Skips items snapshotted less than 7 days ago.
 */
export async function runTrendSnapshot(): Promise<{ snapshotted: number }> {
  const supabase = createServerClient()
  const today = new Date().toISOString().split('T')[0]
  let snapshotted = 0
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('items')
      .select('id, ranking_score, score_snapshot_date')
      .eq('status', 'enriched')
      .range(from, from + BATCH_SIZE - 1)

    if (error) throw new Error(`Trend snapshot fetch failed: ${error.message}`)

    const rows = (data ?? []) as Array<{
      id: string
      ranking_score: number
      score_snapshot_date: string | null
    }>

    const toSnapshot = rows.filter((r) => shouldSnapshot(r.score_snapshot_date))

    for (let i = 0; i < toSnapshot.length; i += WRITE_CONCURRENCY) {
      const chunk = toSnapshot.slice(i, i + WRITE_CONCURRENCY)
      await Promise.allSettled(
        chunk.map((row) =>
          supabase
            .from('items')
            .update({ ranking_score_7d_ago: row.ranking_score, score_snapshot_date: today })
            .eq('id', row.id),
        ),
      )
      snapshotted += chunk.length
    }

    if (rows.length < BATCH_SIZE) break
    from += rows.length
  }

  return { snapshotted }
}

/**
 * Sets trending=true on items where ranking_score increased ≥ 20 points
 * since their 7-day snapshot. Clears trending=false on all others.
 * Runs every day after ranking.
 */
export async function runTrendFlagUpdate(): Promise<{ trendingCount: number }> {
  const supabase = createServerClient()
  let trendingCount = 0
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('items')
      .select('id, ranking_score, ranking_score_7d_ago')
      .eq('status', 'enriched')
      .range(from, from + BATCH_SIZE - 1)

    if (error) throw new Error(`Trend flag fetch failed: ${error.message}`)

    const rows = (data ?? []) as Array<{
      id: string
      ranking_score: number
      ranking_score_7d_ago: number | null
    }>

    const results = await Promise.allSettled(
      rows.map((row) => {
        const trending = isTrending(row.ranking_score, row.ranking_score_7d_ago)
        if (trending) trendingCount++
        return supabase.from('items').update({ trending }).eq('id', row.id)
      }),
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) console.warn(`[trend-detection] ${failed} flag writes failed`)

    if (rows.length < BATCH_SIZE) break
    from += rows.length
  }

  return { trendingCount }
}
```

- [ ] **Run tests to verify they pass**

```bash
npx tsx --test lib/workflows/trend-detection.test.ts
```

Expected: `# pass 11`, `# fail 0`

- [ ] **Commit**

```bash
git add lib/workflows/trend-detection.ts lib/workflows/trend-detection.test.ts
git commit -m "feat: trend detection module — 7-day delta snapshot + flag update"
```

---

## Task 6: TrendingBadge component + ItemCard update

**Files:**
- Create: `components/ui/TrendingBadge.tsx`
- Modify: `components/ItemCard.tsx`

- [ ] **Create TrendingBadge**

```tsx
// components/ui/TrendingBadge.tsx
export function TrendingBadge() {
  return (
    <span className="inline-flex items-center rounded border border-orange-800/50 bg-orange-950/40 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-orange-400">
      ↑ trending
    </span>
  )
}
```

- [ ] **Update ItemCard to show TrendingBadge and orange left border**

In `components/ItemCard.tsx`:

1. Add import at top:
```ts
import { TrendingBadge } from '@/components/ui/TrendingBadge'
```

2. Find the outermost card `<div>` (the one with `className` starting with `group` or `relative`). Add the conditional orange border:
```tsx
<div className={`... ${item.trending ? 'border-l-2 border-orange-500' : ''}`}>
```

3. In the metadata row (where `SourceBadge`, `CategoryBadge`, `HnPrefixBadge` are rendered), add after `HnPrefixBadge`:
```tsx
{item.trending && <TrendingBadge />}
```

- [ ] **Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Commit**

```bash
git add components/ui/TrendingBadge.tsx components/ItemCard.tsx
git commit -m "feat: TrendingBadge component + orange left border on trending ItemCard"
```

---

## Task 7: Re-classification module

**Files:**
- Create: `lib/workflows/reclassification.ts`

- [ ] **Implement the module**

```ts
// lib/workflows/reclassification.ts
import { createServerClient } from '@/lib/supabase/server'
import { enrichItem } from '@/lib/ai/enrich'
import { ProviderBillingError } from '@/lib/ai/provider'
import type { Item } from '@/lib/db/types'

const RECLASSIFY_LIMIT = 20
const ENRICH_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Re-enriches items with low relevance scores or 'Other' category.
 * Uses the same enrichItem() pipeline — updates category, tags, summary, and score.
 * Limit 20 per run to control AI costs.
 */
export async function runReclassification(): Promise<{ reclassified: number; failed: number }> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('status', 'enriched')
    .or('ai_relevance_score.lt.0.5,ai_category.eq.Other')
    .order('created_at', { ascending: true })
    .limit(RECLASSIFY_LIMIT)

  if (error) throw new Error(`Reclassification fetch failed: ${error.message}`)

  const items = (data ?? []) as Item[]
  let reclassified = 0
  let failed = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    try {
      const result = await enrichItem(item)

      if (result.success) {
        const { error: updateErr } = await supabase
          .from('items')
          .update({ ...result.update, needs_reclassification: false })
          .eq('id', item.id)

        if (updateErr) {
          console.error(`[reclassification] DB update failed for ${item.id}:`, updateErr.message)
          failed++
        } else {
          reclassified++
        }
      } else {
        await supabase
          .from('items')
          .update({ needs_reclassification: true })
          .eq('id', item.id)
        console.warn(`[reclassification] Enrichment failed for ${item.id}:`, result.error)
        failed++
      }
    } catch (err) {
      if (err instanceof ProviderBillingError) {
        console.error('[reclassification] Billing error — stopping batch')
        break
      }
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[reclassification] Error for item ${item.id}:`, msg)
      try {
        await supabase.from('items').update({ needs_reclassification: true }).eq('id', item.id)
      } catch { /* best-effort */ }
      failed++
    }

    if (i < items.length - 1) await sleep(ENRICH_DELAY_MS)
  }

  return { reclassified, failed }
}
```

- [ ] **Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Commit**

```bash
git add lib/workflows/reclassification.ts
git commit -m "feat: category re-classification agent — re-enriches low-score and Other items"
```

---

## Task 8: Data quality monitoring — tests + module

**Files:**
- Create: `lib/workflows/data-quality.ts`
- Create: `lib/workflows/data-quality.test.ts`

- [ ] **Write failing tests**

```ts
// lib/workflows/data-quality.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deriveHealthReport } from './data-quality'

describe('deriveHealthReport', () => {
  it('healthy=true when all counts are zero and emptySections is empty', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 0, missingCategory: 0, emptySections: [] })
    assert.equal(r.healthy, true)
  })

  it('healthy=false when stuckNew > 0', () => {
    const r = deriveHealthReport({ stuckNew: 2, failedCount: 0, unranked: 0, missingCategory: 0, emptySections: [] })
    assert.equal(r.healthy, false)
  })

  it('healthy=false when failedCount > 0', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 5, unranked: 0, missingCategory: 0, emptySections: [] })
    assert.equal(r.healthy, false)
  })

  it('healthy=false when unranked > 0', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 1, missingCategory: 0, emptySections: [] })
    assert.equal(r.healthy, false)
  })

  it('healthy=false when missingCategory > 0', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 0, missingCategory: 3, emptySections: [] })
    assert.equal(r.healthy, false)
  })

  it('healthy=false when emptySections is non-empty', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 0, missingCategory: 0, emptySections: ['RAG'] })
    assert.equal(r.healthy, false)
  })

  it('passes anomaly counts through to report unchanged', () => {
    const anomalies = { stuckNew: 1, failedCount: 2, unranked: 3, missingCategory: 4, emptySections: ['RAG', 'Research'] }
    const r = deriveHealthReport(anomalies)
    assert.deepEqual(r.anomalies, anomalies)
  })

  it('checkedAt is a non-empty ISO string', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 0, missingCategory: 0, emptySections: [] })
    assert.ok(typeof r.checkedAt === 'string')
    assert.ok(r.checkedAt.includes('T'))
  })
})
```

- [ ] **Run tests to verify they fail**

```bash
npx tsx --test lib/workflows/data-quality.test.ts
```

Expected: `Error: Cannot find module './data-quality'`

- [ ] **Implement the module**

```ts
// lib/workflows/data-quality.ts
import { createServerClient } from '@/lib/supabase/server'
import { CATEGORIES } from '@/lib/ai/schemas'

export interface AnomalyCounts {
  stuckNew: number
  failedCount: number
  unranked: number
  missingCategory: number
  emptySections: string[]
}

export interface HealthReport {
  healthy: boolean
  checkedAt: string
  anomalies: AnomalyCounts
}

/** Pure — exported for unit tests. */
export function deriveHealthReport(anomalies: AnomalyCounts): HealthReport {
  const healthy =
    anomalies.stuckNew === 0 &&
    anomalies.failedCount === 0 &&
    anomalies.unranked === 0 &&
    anomalies.missingCategory === 0 &&
    anomalies.emptySections.length === 0

  return { healthy, checkedAt: new Date().toISOString(), anomalies }
}

async function postSlackAlert(report: HealthReport): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const { anomalies: a } = report
  const lines = [
    '*AgentRadar — Data Quality Alert* ⚠️',
    `Checked at: ${report.checkedAt}`,
    '',
  ]
  if (a.stuckNew > 0)        lines.push(`• ${a.stuckNew} items stuck in \`status=new\` > 48 h`)
  if (a.failedCount > 0)     lines.push(`• ${a.failedCount} items with \`status=failed\``)
  if (a.unranked > 0)        lines.push(`• ${a.unranked} enriched items with \`ranking_score=0\``)
  if (a.missingCategory > 0) lines.push(`• ${a.missingCategory} enriched items missing \`ai_category\``)
  if (a.emptySections.length > 0) lines.push(`• Empty digest sections: ${a.emptySections.join(', ')}`)

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
    })
  } catch (err) {
    console.warn('[data-quality] Slack webhook failed:', err instanceof Error ? err.message : err)
  }
}

export async function runDataQualityCheck(): Promise<HealthReport> {
  const supabase = createServerClient()
  const stuckCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [stuckNewRes, failedRes, unrankedRes, missingCatRes] = await Promise.all([
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'new').lt('created_at', stuckCutoff),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').eq('ranking_score', 0),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').is('ai_category', null),
  ])

  const categoryChecks = await Promise.all(
    CATEGORIES.map(async (category) => {
      const { count } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'enriched')
        .eq('ai_category', category)
      return { category, count: count ?? 0 }
    }),
  )

  const anomalies: AnomalyCounts = {
    stuckNew:        stuckNewRes.count   ?? 0,
    failedCount:     failedRes.count     ?? 0,
    unranked:        unrankedRes.count   ?? 0,
    missingCategory: missingCatRes.count ?? 0,
    emptySections:   categoryChecks.filter((r) => r.count === 0).map((r) => r.category),
  }

  const report = deriveHealthReport(anomalies)
  if (!report.healthy) await postSlackAlert(report)
  return report
}
```

- [ ] **Run tests to verify they pass**

```bash
npx tsx --test lib/workflows/data-quality.test.ts
```

Expected: `# pass 8`, `# fail 0`

- [ ] **Commit**

```bash
git add lib/workflows/data-quality.ts lib/workflows/data-quality.test.ts
git commit -m "feat: data quality monitoring module with Slack alerts and unit tests"
```

---

## Task 9: Health API route

**Files:**
- Create: `app/api/health/route.ts`

- [ ] **Create the route**

```ts
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { runDataQualityCheck } from '@/lib/workflows/data-quality'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    const report = await runDataQualityCheck()
    // Always 200 — uptime monitors should alert on non-200, not on healthy:false
    return NextResponse.json(report, { status: 200 })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ healthy: false, error, checkedAt: new Date().toISOString() }, { status: 200 })
  }
}
```

- [ ] **Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Commit**

```bash
git add app/api/health/route.ts
git commit -m "feat: add /api/health route — public anomaly report endpoint"
```

---

## Task 10: Digest summaries — DB helper + workflow module

**Files:**
- Create: `lib/db/digest-summaries.ts`
- Create: `lib/workflows/digest-summaries.ts`

- [ ] **Create the DB helper**

```ts
// lib/db/digest-summaries.ts
import { createServerClient } from '@/lib/supabase/server'

/** Returns the Monday of the current week as a Date at midnight UTC. */
export function getCurrentMonday(): Date {
  const now = new Date()
  const day = now.getDay() // 0 = Sun, 1 = Mon
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Fetches all digest summaries for the given week.
 * Returns a Map<category, summary> for O(1) lookups in the digest page.
 * Returns empty Map on error (graceful degradation — digest renders without summaries).
 */
export async function getDigestSummariesForWeek(weekOf: Date): Promise<Map<string, string>> {
  const supabase = createServerClient()
  const weekStr = weekOf.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('digest_summaries')
    .select('category, summary')
    .eq('week_of', weekStr)

  if (error) {
    console.error('[digest-summaries] Fetch failed:', error.message)
    return new Map()
  }

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set((row as { category: string; summary: string }).category, (row as { category: string; summary: string }).summary)
  }
  return map
}
```

- [ ] **Create the workflow module**

```ts
// lib/workflows/digest-summaries.ts
import { createServerClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/provider'
import { CATEGORIES } from '@/lib/ai/schemas'
import { getCurrentMonday } from '@/lib/db/digest-summaries'
import type { Item } from '@/lib/db/types'

const MIN_ITEMS_PER_CATEGORY = 3
const ITEMS_PER_SUMMARY = 5
const SUMMARY_MIN_LENGTH = 50
const SUMMARY_MAX_LENGTH = 300

function isMonday(): boolean {
  return new Date().getDay() === 1
}

async function generateCategorySummary(
  category: string,
  items: Array<Pick<Item, 'title' | 'ai_summary' | 'description'>>,
): Promise<string | null> {
  const itemLines = items
    .map((item, i) => `${i + 1}. "${item.title}" — ${item.ai_summary ?? item.description ?? '(no description)'}`)
    .join('\n')

  const raw = await callAi({
    systemPrompt:
      'You are an editorial assistant for AgentRadar, a discovery hub for AI developer tools. Return valid JSON only.',
    userMessage: `Write a single editorial paragraph (50–300 characters) summarizing this week's highlights in the "${category}" category. Focus on patterns and what's notable. Return JSON: { "summary": "<paragraph>" }\n\nTop items this week:\n${itemLines}`,
    maxTokens: 200,
  })

  try {
    const parsed = JSON.parse(raw) as { summary?: string }
    const summary = parsed.summary?.trim() ?? ''
    if (summary.length < SUMMARY_MIN_LENGTH || summary.length > SUMMARY_MAX_LENGTH) {
      console.warn(`[digest-summaries] Invalid summary length for "${category}": ${summary.length} chars`)
      return null
    }
    return summary
  } catch {
    console.warn(`[digest-summaries] Failed to parse JSON response for "${category}"`)
    return null
  }
}

/**
 * Generates and upserts AI editorial summaries for each digest category.
 * Only runs on Mondays — returns { generated: 0, skipped: 0 } on other days.
 * Skips categories with fewer than 3 enriched items.
 */
export async function runDigestSummaries(): Promise<{ generated: number; skipped: number }> {
  if (!isMonday()) return { generated: 0, skipped: 0 }

  const supabase = createServerClient()
  const weekOf = getCurrentMonday().toISOString().split('T')[0]
  let generated = 0
  let skipped = 0

  for (const category of CATEGORIES) {
    const { data, error } = await supabase
      .from('items')
      .select('title, ai_summary, description')
      .eq('status', 'enriched')
      .eq('ai_category', category)
      .order('ranking_score', { ascending: false })
      .limit(ITEMS_PER_SUMMARY)

    if (error) {
      console.error(`[digest-summaries] Fetch failed for "${category}":`, error.message)
      skipped++
      continue
    }

    const items = (data ?? []) as Array<Pick<Item, 'title' | 'ai_summary' | 'description'>>

    if (items.length < MIN_ITEMS_PER_CATEGORY) {
      skipped++
      continue
    }

    try {
      const summary = await generateCategorySummary(category, items)
      if (!summary) { skipped++; continue }

      const { error: upsertErr } = await supabase
        .from('digest_summaries')
        .upsert({ category, summary, week_of: weekOf }, { onConflict: 'category,week_of' })

      if (upsertErr) {
        console.error(`[digest-summaries] Upsert failed for "${category}":`, upsertErr.message)
        skipped++
      } else {
        generated++
      }
    } catch (err) {
      console.error(`[digest-summaries] AI call failed for "${category}":`, err instanceof Error ? err.message : err)
      skipped++
    }
  }

  return { generated, skipped }
}
```

- [ ] **Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Commit**

```bash
git add lib/db/digest-summaries.ts lib/workflows/digest-summaries.ts
git commit -m "feat: digest summaries DB helper + weekly LLM generation workflow"
```

---

## Task 11: Digest page UI — editorial callout

**Files:**
- Modify: `app/digest/page.tsx`

- [ ] **Import digest summaries helpers at top of file**

```ts
import { getDigestSummariesForWeek, getCurrentMonday } from '@/lib/db/digest-summaries'
```

- [ ] **Fetch summaries in `DigestPage`**

In the `DigestPage` async function, after `const sections = await getDigestSections()`, add:

```ts
const summaries = await getDigestSummariesForWeek(getCurrentMonday())
```

- [ ] **Pass summary to each `DigestSectionBlock`**

Update the render call:

```tsx
<DigestSectionBlock
  key={section.slug}
  section={section}
  index={sectionIndex}
  summary={summaries.get(section.title) ?? null}
/>
```

- [ ] **Update `DigestSectionBlock` to accept and render the summary**

Update the function signature:

```tsx
function DigestSectionBlock({
  section,
  index,
  summary,
}: {
  section: DigestSection
  index: number
  summary: string | null
}) {
```

Add the editorial callout between the section header `<div>` and the items `<div>`. Insert after the closing `</div>` of the section header block:

```tsx
{/* AI editorial summary — only rendered when present */}
{summary && (
  <div className="mb-6 rounded-lg border-l-2 border-indigo-600 bg-zinc-900 px-5 py-4">
    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
      This week
    </p>
    <p className="text-sm leading-relaxed text-zinc-300">{summary}</p>
  </div>
)}
```

- [ ] **Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Commit**

```bash
git add app/digest/page.tsx
git commit -m "feat: render weekly AI editorial summary in each digest section"
```

---

## Task 12: Wire all phases into daily-refresh.ts

**Files:**
- Modify: `lib/workflows/daily-refresh.ts`

- [ ] **Add imports at top of file**

```ts
import { estimatePipelineCost } from '@/lib/workflows/cost-estimation'
import { runTrendSnapshot, runTrendFlagUpdate } from '@/lib/workflows/trend-detection'
import { runReclassification } from '@/lib/workflows/reclassification'
import { runDataQualityCheck } from '@/lib/workflows/data-quality'
import { runDigestSummaries } from '@/lib/workflows/digest-summaries'
import type { CostEstimate } from '@/lib/workflows/cost-estimation'
import type { HealthReport } from '@/lib/workflows/data-quality'
```

- [ ] **Extend `RefreshResult` interface**

Replace the existing `RefreshResult` with:

```ts
export interface RefreshResult {
  success: boolean
  ingestionCounts: IngestionCounts
  titleFixedCount: number
  enrichedCount: number
  failedCount: number
  reclassifiedCount: number
  rankedCount: number
  trendingCount: number
  digestSummariesGenerated: number
  anomaliesFound: number
  estimatedCost: CostEstimate | null
  durationMs: number
  error?: string
}
```

- [ ] **Update `runDailyRefresh` body**

Replace the existing function body with:

```ts
export async function runDailyRefresh(
  enrichLimit: number = DEFAULT_ENRICH_LIMIT,
): Promise<RefreshResult> {
  const start = Date.now()

  try {
    // 0. Cost estimate — pre-ingestion snapshot
    const estimatedCost = await estimatePipelineCost(enrichLimit).catch((err) => {
      console.warn('[daily-refresh] Cost estimation failed:', err instanceof Error ? err.message : err)
      return null
    })

    // 1. Ingestion
    const ingestionCounts = await runIngestion()

    // 2. Title cleanup
    const titleFixedCount = await runTitleCleanup()

    // 3. Trend snapshot (weekly — skips items snapshotted < 7 days ago)
    await runTrendSnapshot().catch((err) =>
      console.error('[daily-refresh] Trend snapshot error:', err instanceof Error ? err.message : err),
    )

    // 4. Enrichment
    const { enriched, failed, billingAbort } = await runEnrichment(enrichLimit)

    // 5. Re-classification
    const { reclassified } = await runReclassification().catch((err) => {
      console.error('[daily-refresh] Reclassification error:', err instanceof Error ? err.message : err)
      return { reclassified: 0, failed: 0 }
    })

    // 6. Ranking
    const rankedCount = await runRanking()

    // 7. Trend flag update (post-ranking)
    const { trendingCount } = await runTrendFlagUpdate().catch((err) => {
      console.error('[daily-refresh] Trend flag update error:', err instanceof Error ? err.message : err)
      return { trendingCount: 0 }
    })

    // 8. Digest summaries (Mondays only)
    const { generated: digestSummariesGenerated } = await runDigestSummaries().catch((err) => {
      console.error('[daily-refresh] Digest summaries error:', err instanceof Error ? err.message : err)
      return { generated: 0, skipped: 0 }
    })

    // 9. Data quality check (always runs)
    const healthReport = await runDataQualityCheck().catch((err) => {
      console.error('[daily-refresh] Data quality check error:', err instanceof Error ? err.message : err)
      return null
    })

    return {
      success: !billingAbort,
      ingestionCounts,
      titleFixedCount,
      enrichedCount: enriched,
      failedCount: failed,
      reclassifiedCount: reclassified,
      rankedCount,
      trendingCount,
      digestSummariesGenerated,
      anomaliesFound: healthReport
        ? Object.values(healthReport.anomalies).reduce<number>(
            (sum, v) => sum + (Array.isArray(v) ? v.length : v),
            0,
          )
        : 0,
      estimatedCost,
      durationMs: Date.now() - start,
      ...(billingAbort
        ? { error: 'Enrichment aborted — provider billing/quota error.' }
        : {}),
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[daily-refresh] Fatal error:', error)
    return {
      success: false,
      ingestionCounts: { github: 0, hn: 0, rss: 0 },
      titleFixedCount: 0,
      enrichedCount: 0,
      failedCount: 0,
      reclassifiedCount: 0,
      rankedCount: 0,
      trendingCount: 0,
      digestSummariesGenerated: 0,
      anomaliesFound: 0,
      estimatedCost: null,
      durationMs: Date.now() - start,
      error,
    }
  }
}
```

- [ ] **Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Commit**

```bash
git add lib/workflows/daily-refresh.ts
git commit -m "feat: wire all Group A phases into runDailyRefresh — 10-phase pipeline"
```

---

## Task 13: npm scripts + full test suite + build

**Files:**
- Modify: `package.json`

- [ ] **Update the test script in `package.json`**

Replace the existing `"test"` script with:

```json
"test": "npx tsx --test lib/ranking/score.test.ts lib/ingestion/title.test.ts lib/workflows/cost-estimation.test.ts lib/workflows/trend-detection.test.ts lib/workflows/data-quality.test.ts"
```

- [ ] **Add health and estimate convenience scripts**

```json
"health": "curl -s https://agentradar-nine.vercel.app/api/health | npx --yes json",
"estimate": "curl -s -H \"Authorization: Bearer $CRON_SECRET\" https://agentradar-nine.vercel.app/api/pipeline/estimate | npx --yes json"
```

- [ ] **Run full test suite**

```bash
npm test
```

Expected: `# tests 69`, `# pass 69`, `# fail 0`  
(54 existing + 8 cost + 11 trend + 8 data-quality = ~81 — exact count may vary by ±2 based on edge case tests.)

- [ ] **Run full build**

```bash
npm run lint && npm run typecheck && npm run build
```

Expected: clean compile, all 8 routes in the route table including `/api/health` and `/api/pipeline/estimate`.

- [ ] **Final commit**

```bash
git add package.json
git commit -m "feat: update test suite to include Group A workflow tests (70+ passing)"
```

---

## Post-deploy checklist

After deploying (`vercel --prod`):

- [ ] `GET /api/health` returns `{ "healthy": true, ... }` (or lists real anomalies)
- [ ] `GET /api/pipeline/estimate` without auth returns `401`
- [ ] `GET /api/pipeline/estimate?limit=50` with `Authorization: Bearer <CRON_SECRET>` returns cost JSON
- [ ] Trigger `/api/refresh/daily` manually — response now includes `trendingCount`, `reclassifiedCount`, `estimatedCost`, `anomaliesFound`
- [ ] After 7 days: verify items appear with `trending: true` in the DB and `TrendingBadge` renders on the homepage
- [ ] On the next Monday: verify `digest_summaries` table has rows and the digest page renders the editorial callout above each section

/**
 * Daily refresh workflow — orchestrates ingestion → enrichment → ranking.
 *
 * This module contains only pure library imports and is safe to use in a
 * Next.js Server / API Route context (no CLI side-effects, no dotenv, no
 * ws polyfill — Next.js handles all of that in its runtime).
 */
import { fetchGithubItems } from '@/lib/ingestion/github'
import { fetchHnItems } from '@/lib/ingestion/hn'
import { fetchRssItems } from '@/lib/ingestion/rss'
import { upsertItems } from '@/lib/db/items'
import { enrichItem } from '@/lib/ai/enrich'
import { ProviderBillingError } from '@/lib/ai/provider'
import { computeRankingScore } from '@/lib/ranking/score'
import { createServerClient } from '@/lib/supabase/server'
import type { Item, ItemEnrichmentUpdate } from '@/lib/db/types'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default cap on items enriched per run — keeps AI costs predictable. */
export const DEFAULT_ENRICH_LIMIT = 150

/** Delay between enrichment calls (ms) — avoids hammering the AI provider. */
const ENRICH_DELAY_MS = 500

/** Concurrent DB writes for ranking score updates. */
const RANK_WRITE_CONCURRENCY = 50

/** Pagination batch size when fetching enriched items for ranking. */
const RANK_BATCH_SIZE = 500

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestionCounts {
  github: number
  hn: number
  rss: number
}

export interface RefreshResult {
  success: boolean
  ingestionCounts: IngestionCounts
  enrichedCount: number
  failedCount: number
  rankedCount: number
  durationMs: number
  /** Set when the run terminated early due to a billing/quota error. */
  error?: string
}

// ── Phase 1: Ingestion ────────────────────────────────────────────────────────

/**
 * Fetch and upsert items from all three sources concurrently.
 * Errors from one source do not block the others.
 */
async function runIngestion(): Promise<IngestionCounts> {
  const [githubItems, hnItems, rssItems] = await Promise.all([
    fetchGithubItems().catch((err) => {
      console.error('[daily-refresh] GitHub ingestion error:', err instanceof Error ? err.message : err)
      return [] as Awaited<ReturnType<typeof fetchGithubItems>>
    }),
    fetchHnItems().catch((err) => {
      console.error('[daily-refresh] HN ingestion error:', err instanceof Error ? err.message : err)
      return [] as Awaited<ReturnType<typeof fetchHnItems>>
    }),
    fetchRssItems().catch((err) => {
      console.error('[daily-refresh] RSS ingestion error:', err instanceof Error ? err.message : err)
      return [] as Awaited<ReturnType<typeof fetchRssItems>>
    }),
  ])

  const [githubResult, hnResult, rssResult] = await Promise.all([
    upsertItems(githubItems),
    upsertItems(hnItems),
    upsertItems(rssItems),
  ])

  return {
    github: githubResult.inserted,
    hn: hnResult.inserted,
    rss: rssResult.inserted,
  }
}

// ── Phase 2: Enrichment ───────────────────────────────────────────────────────

async function fetchPendingItems(limit: number): Promise<Item[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .or('status.eq.new,ai_summary.is.null')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`Failed to fetch pending items: ${error.message}`)
  return (data ?? []) as Item[]
}

async function saveEnrichment(itemId: string, update: ItemEnrichmentUpdate): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase.from('items').update(update).eq('id', itemId)
  if (error) throw new Error(`DB enrichment update failed: ${error.message}`)
}

async function saveFailure(itemId: string, errorMessage: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('items')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', itemId)
  if (error) throw new Error(`DB failure update failed: ${error.message}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface EnrichmentResult {
  enriched: number
  failed: number
  billingAbort: boolean
}

async function runEnrichment(limit: number): Promise<EnrichmentResult> {
  const items = await fetchPendingItems(limit)
  let enriched = 0
  let failed = 0
  let billingAbort = false

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    try {
      const result = await enrichItem(item)
      if (result.success) {
        await saveEnrichment(item.id, result.update)
        enriched++
      } else {
        await saveFailure(item.id, result.error)
        failed++
      }
    } catch (err) {
      if (err instanceof ProviderBillingError) {
        billingAbort = true
        break // stop — billing errors affect the whole account, not just one item
      }
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[daily-refresh] Enrichment error for item ${item.id}:`, msg)
      try { await saveFailure(item.id, msg) } catch { /* best-effort */ }
      failed++
    }

    // Rate-limit courtesy — skip the delay after the very last item.
    if (i < items.length - 1) await sleep(ENRICH_DELAY_MS)
  }

  return { enriched, failed, billingAbort }
}

// ── Phase 3: Ranking ──────────────────────────────────────────────────────────

/**
 * Fetch every enriched item using range-based pagination to avoid Supabase's
 * implicit 1,000-row cap.
 */
async function fetchAllEnrichedItems(): Promise<Item[]> {
  const supabase = createServerClient()
  const all: Item[] = []
  let from = 0

  while (true) {
    const to = from + RANK_BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('status', 'enriched')
      .not('ai_relevance_score', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) throw new Error(`Ranking fetch failed: ${error.message}`)
    const rows = (data ?? []) as Item[]
    all.push(...rows)
    if (rows.length < RANK_BATCH_SIZE) break
    from += rows.length
  }

  return all
}

async function runRanking(): Promise<number> {
  const items = await fetchAllEnrichedItems()
  if (items.length === 0) return 0

  const maxStars = items.reduce((max, item) => Math.max(max, item.github_stars ?? 0), 0)
  const scored = items.map((item) => ({
    item,
    score: computeRankingScore(item, { maxStars }).final,
  }))

  const supabase = createServerClient()
  let updated = 0

  for (let i = 0; i < scored.length; i += RANK_WRITE_CONCURRENCY) {
    const chunk = scored.slice(i, i + RANK_WRITE_CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map(({ item, score }) =>
        supabase
          .from('items')
          .update({ ranking_score: score })
          .eq('id', item.id)
          .then(({ error }) => {
            if (error) throw new Error(error.message)
          }),
      ),
    )
    updated += results.filter((r) => r.status === 'fulfilled').length
  }

  return updated
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the full daily refresh pipeline:
 *   1. Ingest from GitHub, HN, and RSS (concurrent)
 *   2. Enrich new/failed items with AI (capped at `enrichLimit`)
 *   3. Recompute ranking scores for all enriched items
 *
 * Always resolves — never throws. Any fatal error is captured in `result.error`.
 */
export async function runDailyRefresh(
  enrichLimit: number = DEFAULT_ENRICH_LIMIT,
): Promise<RefreshResult> {
  const start = Date.now()

  try {
    // 1. Ingestion — all three sources in parallel.
    const ingestionCounts = await runIngestion()

    // 2. Enrichment — sequential with rate-limit delay, capped at limit.
    const { enriched, failed, billingAbort } = await runEnrichment(enrichLimit)

    // 3. Ranking — paginated fetch, concurrent writes.
    const rankedCount = await runRanking()

    return {
      success: !billingAbort,
      ingestionCounts,
      enrichedCount: enriched,
      failedCount: failed,
      rankedCount,
      durationMs: Date.now() - start,
      ...(billingAbort
        ? { error: 'Enrichment aborted — provider billing/quota error. Top up your account and re-run.' }
        : {}),
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[daily-refresh] Fatal error:', error)
    return {
      success: false,
      ingestionCounts: { github: 0, hn: 0, rss: 0 },
      enrichedCount: 0,
      failedCount: 0,
      rankedCount: 0,
      durationMs: Date.now() - start,
      error,
    }
  }
}

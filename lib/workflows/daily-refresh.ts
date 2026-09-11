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
import { ProviderRequestError, sanitizeProviderErrorDetail } from '@/lib/ai/provider'
import { computeRankingScore } from '@/lib/ranking/score'
import { normalizeTitle, deriveTitleFromUrl, deriveTitleFromDescription } from '@/lib/ingestion/title'
import { createServerClient } from '@/lib/supabase/server'
import type { Item, ItemEnrichmentUpdate } from '@/lib/db/types'
import {
  assertWithinDailyAiBudget,
  estimatePipelineCost,
  MAX_TRANSLATION_ITEMS,
  parseDailyAiBudget,
} from '@/lib/workflows/cost-estimation'
import { runTrendSnapshot, runTrendFlagUpdate } from '@/lib/workflows/trend-detection'
import { runReclassification } from '@/lib/workflows/reclassification'
import { runDataQualityCheck } from '@/lib/workflows/data-quality'
import { runDigestSummaries } from '@/lib/workflows/digest-summaries'
import { runTranslation } from '@/lib/workflows/translation'
import type { CostEstimate } from '@/lib/workflows/cost-estimation'
import { logPipelineRun } from '@/lib/db/pipeline-runs'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default cap on items enriched per run — keeps AI costs predictable. */
export const DEFAULT_ENRICH_LIMIT = 30
export const MAX_DAILY_ENRICH_LIMIT = 50

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
  titleFixedCount: number
  enrichedCount: number
  failedCount: number
  reclassifiedCount: number
  rankedCount: number
  trendingCount: number
  translatedCount: number
  digestSummariesGenerated: number
  anomaliesFound: number
  estimatedCost: CostEstimate | null
  durationMs: number
  /** Set when the run terminated early due to a fatal or provider-level error. */
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

// ── Phase 1.5: Title cleanup ──────────────────────────────────────────────────

/**
 * Fix blank or placeholder titles on newly ingested items before enrichment
 * runs, so the AI receives the best possible title as input context.
 *
 * Resolution order (mirrors scripts/cleanup-titles.ts):
 *   1. raw_data title fields (for RSS items where the parser returned empty string).
 *   2. URL path slug derivation.
 *   3. First sentence of description.
 *
 * HN items are skipped — their "Show HN:" prefixes are handled at display time.
 */
async function runTitleCleanup(): Promise<number> {
  const supabase = createServerClient()

  type Row = {
    id: string
    source: string
    title: string | null
    url: string
    description: string | null
    raw_data: Record<string, unknown> | null
  }

  // Fetch items with null or empty-string titles (the two bad-title forms found in audit).
  const [nullResult, emptyResult] = await Promise.all([
    supabase.from('items').select('id, source, title, url, description, raw_data').is('title', null),
    supabase.from('items').select('id, source, title, url, description, raw_data').eq('title', ''),
  ])

  const seen = new Set<string>()
  const toFix: Row[] = []
  for (const row of [...(nullResult.data ?? []), ...(emptyResult.data ?? [])] as Row[]) {
    if (!seen.has(row.id)) {
      seen.add(row.id)
      toFix.push(row)
    }
  }

  if (toFix.length === 0) return 0

  let fixed = 0
  for (const item of toFix) {
    // HN prefix handling is display-only — stored title is not changed.
    if (item.source === 'hackernews') continue

    const rd = item.raw_data as Record<string, unknown> | null
    const better =
      (rd && normalizeTitle(rd.title as string | null)) ??
      deriveTitleFromUrl(item.url) ??
      deriveTitleFromDescription(item.description)

    if (!better) continue

    const { error } = await supabase.from('items').update({ title: better }).eq('id', item.id)
    if (!error) {
      console.log(`[daily-refresh] Title fixed for ${item.id}: "${better}"`)
      fixed++
    }
  }

  return fixed
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
  providerAbortMessage: string | null
}

async function runEnrichment(limit: number): Promise<EnrichmentResult> {
  const items = await fetchPendingItems(limit)
  let enriched = 0
  let failed = 0
  let providerAbortMessage: string | null = null

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
      if (err instanceof ProviderRequestError) {
        providerAbortMessage = err.message
        break // provider-level failures affect the batch, not just one item
      }
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[daily-refresh] Enrichment error for item ${item.id}:`, msg)
      try { await saveFailure(item.id, msg) } catch { /* best-effort */ }
      failed++
    }

    // Rate-limit courtesy — skip the delay after the very last item.
    if (i < items.length - 1) await sleep(ENRICH_DELAY_MS)
  }

  return { enriched, failed, providerAbortMessage }
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
 * Run the full daily refresh pipeline (11 phases):
 *   1. Ingest from GitHub, HN, and RSS (concurrent)
 *   2. Title cleanup — fix blank/placeholder titles before enrichment
 *   3. Cost guard — fail closed before paid AI work
 *   4. Trend snapshot (every three days — skips newer snapshots)
 *   5. Enrichment — sequential with rate-limit delay, capped at limit
 *   6. Re-classification — re-categorize items post-enrichment
 *   7. Ranking — paginated fetch, concurrent writes
 *   8. Trend flag update (post-ranking)
 *   9. Translation — Simplified Chinese
 *  10. Digest summaries (Mondays only)
 *  11. Data quality check (always runs)
 *
 * Always resolves — never throws. Any fatal error is captured in `result.error`.
 */
export async function runDailyRefresh(
  enrichLimit: number = DEFAULT_ENRICH_LIMIT,
): Promise<RefreshResult> {
  const start = Date.now()
  let ingestionCounts: IngestionCounts = { github: 0, hn: 0, rss: 0 }
  let titleFixedCount = 0
  let estimatedCost: CostEstimate | null = null

  try {
    // 1. Ingestion
    ingestionCounts = await runIngestion()

    // 2. Title cleanup
    titleFixedCount = await runTitleCleanup()

    // 3. Cost guard — include items just ingested and fail before paid AI work.
    estimatedCost = await estimatePipelineCost(enrichLimit)
    const maxDailyAiCostUsd = parseDailyAiBudget(process.env.MAX_DAILY_AI_COST_USD)
    assertWithinDailyAiBudget(estimatedCost.estimatedUsd, maxDailyAiCostUsd)

    // 4. Trend snapshot (every three days — skips newer snapshots)
    await runTrendSnapshot().catch((err) =>
      console.error('[daily-refresh] Trend snapshot error:', err instanceof Error ? err.message : err),
    )

    // 5. Enrichment
    const { enriched, failed, providerAbortMessage } = await runEnrichment(enrichLimit)

    if (providerAbortMessage) {
      const providerFailureResult: RefreshResult = {
        success: false,
        ingestionCounts,
        titleFixedCount,
        enrichedCount: enriched,
        failedCount: failed,
        reclassifiedCount: 0,
        rankedCount: 0,
        trendingCount: 0,
        translatedCount: 0,
        digestSummariesGenerated: 0,
        anomaliesFound: 0,
        estimatedCost,
        durationMs: Date.now() - start,
        error: providerAbortMessage,
      }
      await logPipelineRun(providerFailureResult)
      return providerFailureResult
    }

    // 6. Re-classification
    const { reclassified } = await runReclassification()

    // 7. Ranking
    const rankedCount = await runRanking()

    // 8. Trend flag update (post-ranking)
    const { trendingCount } = await runTrendFlagUpdate().catch((err) => {
      console.error('[daily-refresh] Trend flag update error:', err instanceof Error ? err.message : err)
      return { trendingCount: 0 }
    })

    // 9. Translation — Simplified Chinese (top-ranked untranslated items)
    const { translated: translatedCount } = await runTranslation(MAX_TRANSLATION_ITEMS)

    // 10. Digest summaries (Mondays only)
    const { generated: digestSummariesGenerated } = await runDigestSummaries()

    // 11. Data quality check (always runs)
    const healthReport = await runDataQualityCheck().catch((err) => {
      console.error('[daily-refresh] Data quality check error:', err instanceof Error ? err.message : err)
      return null
    })

    const successResult: RefreshResult = {
      success: true,
      ingestionCounts,
      titleFixedCount,
      enrichedCount: enriched,
      failedCount: failed,
      reclassifiedCount: reclassified,
      rankedCount,
      trendingCount,
      translatedCount,
      digestSummariesGenerated,
      anomaliesFound: healthReport
        ? Object.values(healthReport.anomalies).reduce<number>(
            (sum, v) => sum + (Array.isArray(v) ? v.length : v),
            0,
          )
        : 0,
      estimatedCost,
      durationMs: Date.now() - start,
    }
    await logPipelineRun(successResult)
    return successResult
  } catch (err) {
    const error = sanitizeProviderErrorDetail(err instanceof Error ? err.message : String(err))
    console.error('[daily-refresh] Fatal error:', error)
    const failResult: RefreshResult = {
      success: false,
      ingestionCounts,
      titleFixedCount,
      enrichedCount: 0,
      failedCount: 0,
      reclassifiedCount: 0,
      rankedCount: 0,
      trendingCount: 0,
      translatedCount: 0,
      digestSummariesGenerated: 0,
      anomaliesFound: 0,
      estimatedCost,
      durationMs: Date.now() - start,
      error,
    }
    await logPipelineRun(failResult)
    return failResult
  }
}

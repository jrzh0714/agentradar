import { createServerClient } from '@/lib/supabase/server'
import { activeModel } from '@/lib/ai/provider'
import { CATEGORIES } from '@/lib/ai/schemas'

export interface ModelCostRates {
  /** Worst-case enrichment cost, including its one validation retry. */
  enrichmentItemUsd: number
  translationItemUsd: number
  digestSummaryUsd: number
}

/**
 * Conservative standard-rate exposure for the bounded prompts in this repo.
 * These deliberately round above the current list-price calculation so the
 * guard stays useful when outputs reach their token cap. Revisit on any model,
 * prompt-size, retry-policy, or provider-pricing change.
 */
export const MODEL_RATES: Record<string, ModelCostRates> = {
  'gpt-5.4-nano': {
    enrichmentItemUsd: 0.005,
    translationItemUsd: 0.0008,
    digestSummaryUsd: 0.001,
  },
  'gpt-5.4-nano-2026-03-17': {
    enrichmentItemUsd: 0.005,
    translationItemUsd: 0.0008,
    digestSummaryUsd: 0.001,
  },
  'gpt-4o-mini': {
    enrichmentItemUsd: 0.004,
    translationItemUsd: 0.0005,
    digestSummaryUsd: 0.0008,
  },
  'gpt-4o-mini-2024-07-18': {
    enrichmentItemUsd: 0.004,
    translationItemUsd: 0.0005,
    digestSummaryUsd: 0.0008,
  },
  'gpt-4o': {
    enrichmentItemUsd: 0.05,
    translationItemUsd: 0.005,
    digestSummaryUsd: 0.01,
  },
  'claude-3-5-haiku-20241022': {
    enrichmentItemUsd: 0.02,
    translationItemUsd: 0.002,
    digestSummaryUsd: 0.004,
  },
  'claude-3-5-sonnet-20241022': {
    enrichmentItemUsd: 0.08,
    translationItemUsd: 0.008,
    digestSummaryUsd: 0.015,
  },
  mock: {
    enrichmentItemUsd: 0,
    translationItemUsd: 0,
    digestSummaryUsd: 0,
  },
}

export const MAX_RECLASSIFICATION_ITEMS = 10
export const MAX_TRANSLATION_ITEMS = 20
export const MAX_DIGEST_SUMMARIES = CATEGORIES.length
export const DEFAULT_MAX_DAILY_AI_COST_USD = 1

/**
 * Re-check rates whenever a model changes. Unknown models fail closed instead
 * of silently inheriting another model's estimate.
 */

export interface CostEstimate {
  pendingItems: number
  willProcess: number
  ratePerItem: number
  estimatedUsd: number
  breakdown: {
    enrichmentUsd: number
    reclassificationUsd: number
    translationUsd: number
    digestSummariesUsd: number
  }
  assumptions: {
    reclassificationItems: number
    translationItems: number
    digestSummaryCalls: number
  }
  model: string
  provider: string
}

function roundUpUsd(value: number): number {
  return Math.ceil(value * 10_000) / 10_000
}

/** Pure worst-case estimate for every paid phase in one refresh run. */
export function computeCostEstimate(
  pendingItems: number,
  enrichLimit: number,
  rates: ModelCostRates,
): Omit<CostEstimate, 'model' | 'provider'> {
  const willProcess = Math.min(pendingItems, enrichLimit)
  const breakdown = {
    enrichmentUsd: roundUpUsd(willProcess * rates.enrichmentItemUsd),
    reclassificationUsd: roundUpUsd(MAX_RECLASSIFICATION_ITEMS * rates.enrichmentItemUsd),
    translationUsd: roundUpUsd(MAX_TRANSLATION_ITEMS * rates.translationItemUsd),
    digestSummariesUsd: roundUpUsd(MAX_DIGEST_SUMMARIES * rates.digestSummaryUsd),
  }
  const estimatedUsd = Object.values(breakdown)
    .reduce((sum, value) => sum + Math.round(value * 10_000), 0) / 10_000

  return {
    pendingItems,
    willProcess,
    ratePerItem: rates.enrichmentItemUsd,
    estimatedUsd,
    breakdown,
    assumptions: {
      reclassificationItems: MAX_RECLASSIFICATION_ITEMS,
      translationItems: MAX_TRANSLATION_ITEMS,
      digestSummaryCalls: MAX_DIGEST_SUMMARIES,
    },
  }
}

/** Pure conservative estimate for the standalone enrichment script. */
export function estimateStandaloneEnrichmentCost(itemCount: number, model: string): number {
  const rates = MODEL_RATES[model]
  if (!rates) throw new Error(`No cost rate configured for AI model "${model}"`)
  return roundUpUsd(itemCount * rates.enrichmentItemUsd)
}

/** Parse a positive USD budget. Missing uses the default; invalid values fail closed. */
export function parseDailyAiBudget(raw: string | undefined): number {
  if (!raw?.trim()) return DEFAULT_MAX_DAILY_AI_COST_USD
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('MAX_DAILY_AI_COST_USD must be a positive number')
  }
  return parsed
}

/** Fail closed before any paid AI phase if its estimate exceeds the run budget. */
export function assertWithinDailyAiBudget(estimatedUsd: number, maxUsd: number): void {
  if (estimatedUsd > maxUsd) {
    throw new Error(
      `Estimated AI cost $${estimatedUsd.toFixed(4)} exceeds the $${maxUsd.toFixed(2)} daily limit`,
    )
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
  const rates = MODEL_RATES[model]
  if (rates === undefined) {
    throw new Error(`No cost rate configured for AI model "${model}"`)
  }

  return {
    ...computeCostEstimate(pendingItems, enrichLimit, rates),
    model,
    provider,
  }
}

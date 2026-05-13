import { createServerClient } from '@/lib/supabase/server'
import { activeModel } from '@/lib/ai/provider'

export const MODEL_RATES: Record<string, number> = {
  'gpt-4o-mini': 0.0002,
  'gpt-4o': 0.002,
  'claude-3-5-haiku-20241022': 0.0002,
  'claude-3-5-sonnet-20241022': 0.003,
  'mock': 0,
}

/**
 * Translation cost per item (Simplified Chinese).
 *
 * Based on GPT-4o-mini rates ($0.15/1M input, $0.60/1M output):
 *   ~245 input tokens (system prompt + English text) → $0.037 / 1000 items
 *   ~200 output tokens (Chinese text)               → $0.120 / 1000 items
 *   Total ≈ $0.0002/item  →  $0.40 for 2,000-item corpus
 *
 * Monthly ongoing (30 new items/day):
 *   30 × $0.0002 × 30 days ≈ $0.18/month
 */
export const TRANSLATION_RATE_PER_ITEM = 0.0002

/**
 * Full operational cost breakdown (monthly, approximate).
 *
 * | Service           | Cost/month | Notes                                       |
 * |-------------------|-----------|---------------------------------------------|
 * | Vercel Pro        | $20.00    | Required for Cron Jobs                      |
 * | Supabase          |  $0.00    | Free tier (≤500MB DB, ≤2GB bandwidth)       |
 * | AI enrichment     |  $0.18    | 30 items/day × $0.0002 × 30 days           |
 * | AI translation ZH |  $0.18    | 30 items/day × $0.0002 × 30 days           |
 * | AI digest summ.   |  $0.26    | 13 categories × 4 Mondays × $0.005/call    |
 * | AI reclassify     |  $0.10    | ~500 items/month × $0.0002                  |
 * | GitHub API        |  $0.00    | Authenticated; 5,000 req/hour               |
 * | Star refresh      |  $0.00    | GitHub API only                             |
 * |-------------------|-----------|---------------------------------------------|
 * | TOTAL             | ~$20.72   | Dominated by Vercel Pro                     |
 *
 * Without Vercel Pro (manual pipeline triggers): ~$0.72/month
 * One-time translation of 2,000-item corpus: ~$0.40
 */

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

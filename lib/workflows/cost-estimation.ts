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
